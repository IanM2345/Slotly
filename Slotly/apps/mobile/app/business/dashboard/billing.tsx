// apps/mobile/app/business/dashboard/billing.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { View, ScrollView, StyleSheet, Alert, Platform } from "react-native";
import {
  Text,
  Surface,
  ActivityIndicator,
  IconButton,
  Button,
  useTheme,
  Switch,
  Divider,
} from "react-native-paper";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useTier } from "../../../context/TierContext";
import { VerificationGate } from "../../../components/VerificationGate";
import { Section } from "../../../components/Section";
import { TIER_NAMES } from "../../../lib/featureMatrix";
import type { BusinessTier } from "../../../lib/types";

// API
import {
  getCurrentSubscription,
  getSubscriptionPayments,
  startOrChangeSubscription,
  payAndWait,
} from "../../../lib/api/modules/subscription"; // Fixed import path

type SubscriptionRow = {
  id: string;
  businessId: string;
  plan: "LEVEL_1" | "LEVEL_2" | "LEVEL_3" | "LEVEL_4" | "LEVEL_5" | "LEVEL_6";
  startDate: string;
  endDate: string;
  isActive: boolean;
  amount?: number | null;
};

type PaymentRow = {
  id: string;
  amount: number;
  currency: string;
  status: string; // PENDING | SUCCESS | FAILED | ...
  createdAt: string;
  checkoutLink?: string | null;
};

const planLabel: Record<SubscriptionRow["plan"], string> = {
  LEVEL_1: "Starter",
  LEVEL_2: "Basic",
  LEVEL_3: "Pro",
  LEVEL_4: "Business",
  LEVEL_5: "Enterprise",
  LEVEL_6: "Premium",
};

const tierToPlan: Record<BusinessTier, SubscriptionRow["plan"]> = {
  level1: "LEVEL_1",
  level2: "LEVEL_2",
  level3: "LEVEL_3",
  level4: "LEVEL_4",
  level5: "LEVEL_5",
  level6: "LEVEL_6",
};

export default function BillingScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { tier, setTier } = useTier();

  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<SubscriptionRow | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [autoRenew, setAutoRenew] = useState(true); // placeholder toggle for now
  const [busyPay, setBusyPay] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const s = await getCurrentSubscription(); // GET /api/manager/subscription
      setSub(s);
      if (s?.id) {
        const list = await getSubscriptionPayments(s.id); // GET list
        setPayments(Array.isArray(list) ? list : []);
        // Sync TierContext (optional): map backend plan to UI tier
        const uiTier = (Object.keys(tierToPlan) as BusinessTier[]).find((k) => tierToPlan[k] === s.plan);
        if (uiTier && uiTier !== tier) setTier(uiTier);
      } else {
        setPayments([]);
      }
    } catch (e: any) {
      console.error("Load billing failed:", e?.message || e);
      setSub(null);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const statusText = useMemo(() => {
    if (!sub) return "NO SUBSCRIPTION";
    if (sub.isActive) return "ACTIVE";
    const end = sub.endDate ? new Date(sub.endDate) : null;
    if (end && end < new Date()) return "PAST_DUE";
    return "INACTIVE";
  }, [sub]);

  const nextBillingDate = useMemo(() => (sub?.endDate ? new Date(sub.endDate) : null), [sub]);

  const formatDate = (d?: Date | null) =>
    d ? d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "—";

  const getStatusColor = (s: string) => {
    switch (s) {
      case "ACTIVE":
      case "SUCCESS":
      case "PAID":
        return "#2E7D32";
      case "PENDING":
      case "INACTIVE":
        return "#FBC02D";
      case "FAILED":
      case "PAST_DUE":
      case "CANCELLED":
        return "#C62828";
      default:
        return "#6B7280";
    }
  };

  async function handlePayNow() {
    try {
      if (!sub?.id) return Alert.alert("No subscription", "Create a subscription first.");
      setBusyPay(true);

      // Deep links to return/cancel pages for the mobile app
      const returnUrl = Linking.createURL("/subscription/return");
      const cancelUrl = Linking.createURL("/subscription/cancel");

      // Open checkout and poll until paid
      const { paid } = await payAndWait({
        subscriptionId: sub.id,
        returnUrl,
        cancelUrl,
        amount: sub.amount ?? 0,
        currency: "KES",
        customer: null,
        metadata: {},
        open: (url: string) => WebBrowser.openBrowserAsync(url),
      }); // uses /api/payments/subscriptionPayments under the hood

      if (paid) {
        Alert.alert("Payment successful", "Your subscription has been updated.");
      } else {
        Alert.alert("Pending", "We haven't received confirmation yet. You can refresh later.");
      }
      await load();
    } catch (e: any) {
      console.error("Pay now failed:", e?.message || e);
      Alert.alert("Payment error", e?.message || "Something went wrong");
    } finally {
      setBusyPay(false);
    }
  }

  async function handlePlanSelect(selectedTier: BusinessTier) {
    const requestedPlan = tierToPlan[selectedTier];
    if (!requestedPlan) return;

    try {
      // Ask server to start plan change; it will compute price & either activate or return a checkoutUrl
      const res = await startOrChangeSubscription({ plan: requestedPlan });

      // For LEVEL_1: activated immediately (active: true)
      if (res?.active && res?.subscriptionId) {
        Alert.alert("Plan updated", `${planLabel[requestedPlan]} is now active.`);
        await load();
        return;
      }

      // For paid plans: open returned checkout URL (if present), then refresh
      if (res?.checkoutUrl && res?.subscriptionId) {
        await WebBrowser.openBrowserAsync(res.checkoutUrl);
        // Optional: also poll via getSubscriptionPayments if you want immediate update
        await load();
        return;
      }

      // Fallback: if server didn't start checkout, let user tap Pay now
      Alert.alert("Plan requested", "Please complete payment to activate.");
      await load();
    } catch (e: any) {
      console.error("Change plan failed:", e?.message || e);
      Alert.alert("Change plan error", e?.message || "Could not change plan");
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading billing information...</Text>
      </View>
    );
  }

  return (
    <VerificationGate>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <IconButton icon="arrow-left" size={24} iconColor={theme.colors.onSurface} onPress={() => router.back()} />
          <Text style={styles.title}>Billing & Subscription</Text>
        </View>

        {/* Current Plan */}
        <Section title="Current Plan">
          <Surface style={styles.currentPlanCard} elevation={2}>
            {sub ? (
              <>
                <View style={styles.planHeader}>
                  <View style={styles.planInfo}>
                    <Text style={styles.planName}>{planLabel[sub.plan] ?? sub.plan}</Text>
                    <Text style={styles.planPrice}>
                      {sub.amount && sub.amount > 0 ? `KSh ${sub.amount.toLocaleString()}/month` : "Free"}
                    </Text>
                  </View>
                  <View style={styles.planStatus}>
                    <Text style={[styles.statusText, { color: getStatusColor(statusText) }]}>{statusText}</Text>
                  </View>
                </View>

                <View style={styles.planDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Renews on:</Text>
                    <Text style={styles.detailValue}>{formatDate(nextBillingDate)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Auto-renew:</Text>
                    {/* Placeholder toggle — wire to backend when you add it */}
                    <Switch value={autoRenew} onValueChange={() => setAutoRenew((v) => !v)} />
                  </View>
                </View>

                <View style={styles.planActions}>
                  <Button mode="outlined" onPress={handlePayNow} style={styles.planActionBtn} loading={busyPay}>
                    Pay now
                  </Button>
                  <Button
                    mode="contained"
                    onPress={() => router.push("/business/dashboard/coupons")}
                    style={styles.planActionBtn}
                  >
                    Manage Plan
                  </Button>
                </View>
              </>
            ) : (
              <>
                <Text style={{ marginBottom: 12 }}>No active subscription found.</Text>
                <Button mode="contained" onPress={() => handlePlanSelect("level1")}>
                  Activate Free Plan
                </Button>
              </>
            )}
          </Surface>
        </Section>

        {/* Available Plans (wired to real plan change) */}
        <Section title="Available Plans">
          <View style={styles.plansContainer}>
            {(
              [
                { tier: "level1", name: "Starter", price: 0 },
                { tier: "level2", name: "Basic", price: 999 },
                { tier: "level3", name: "Pro", price: 2999 },
                { tier: "level4", name: "Business", price: 6999 },
                { tier: "level5", name: "Enterprise", price: 14999 },
                { tier: "level6", name: "Premium", price: 30000 },
              ] as { tier: BusinessTier; name: string; price: number }[]
            ).map((p) => (
              <Surface
                key={p.tier}
                style={[styles.planCard, p.tier === tier && styles.currentPlanHighlight]}
                elevation={p.tier === tier ? 4 : 2}
              >
                <View style={styles.planCardHeader}>
                  <Text style={styles.planCardName}>{p.name}</Text>
                  <Text style={styles.planCardPrice}>{p.price === 0 ? "Free" : `KSh ${p.price.toLocaleString()}/mo`}</Text>
                </View>
                <Button
                  mode={p.tier === tier ? "outlined" : "contained"}
                  onPress={() => handlePlanSelect(p.tier)}
                  style={[styles.selectPlanBtn, p.tier === tier && styles.currentPlanBtn]}
                  disabled={p.tier === tier}
                >
                  {p.tier === tier ? "CURRENT PLAN" : "Select Plan"}
                </Button>
              </Surface>
            ))}
          </View>
        </Section>

        {/* Payment History */}
        <Section title="Recent Payments">
          <Surface style={styles.historyCard} elevation={2}>
            {payments.length === 0 ? (
              <View style={{ padding: 16 }}>
                <Text style={{ color: "#6B7280" }}>No payments yet.</Text>
              </View>
            ) : (
              payments.map((payment, idx) => (
                <View key={payment.id}>
                  <View style={styles.historyRow}>
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyDescription}>Subscription payment</Text>
                      <Text style={styles.historyDate}>
                        {new Date(payment.createdAt).toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.historyAmount}>
                      <Text style={styles.amountText}>
                        {payment.currency || "KES"} {Number(payment.amount).toLocaleString()}
                      </Text>
                      <Text style={[styles.historyStatus, { color: getStatusColor(payment.status) }]}>
                        {payment.status}
                      </Text>
                    </View>
                  </View>
                  {idx < payments.length - 1 && <Divider style={styles.historyDivider} />}
                </View>
              ))
            )}
          </Surface>
        </Section>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </VerificationGate>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6B7280",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1559C1",
  },
  currentPlanCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#1559C1",
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 16,
    color: "#2E7D32",
    fontWeight: "600",
  },
  planStatus: {
    alignItems: "flex-end",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  planDetails: {
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  detailValue: {
    fontSize: 14,
    color: "#1F2937",
    fontWeight: "600",
  },
  planActions: {
    flexDirection: "row",
    gap: 12,
  },
  planActionBtn: {
    flex: 1,
  },
  plansContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  planCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    position: "relative",
  },
  currentPlanHighlight: {
    borderWidth: 2,
    borderColor: "#1559C1",
  },
  popularPlan: {
    borderWidth: 2,
    borderColor: "#F57C00",
  },
  popularBadge: {
    position: "absolute",
    top: -8,
    left: 20,
    backgroundColor: "#F57C00",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
  },
  planCardHeader: {
    marginBottom: 16,
    marginTop: 8,
  },
  planCardName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 4,
  },
  planCardPrice: {
    fontSize: 16,
    color: "#2E7D32",
    fontWeight: "600",
  },
  planFeatures: {
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  featureIcon: {
    color: "#2E7D32",
    fontSize: 14,
    fontWeight: "bold",
    marginRight: 8,
    width: 16,
  },
  featureText: {
    fontSize: 14,
    color: "#374151",
    flex: 1,
  },
  selectPlanBtn: {
    borderRadius: 25,
  },
  currentPlanBtn: {
    borderColor: "#1559C1",
  },
  historyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginHorizontal: 16,
    overflow: "hidden",
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  historyInfo: {
    flex: 1,
  },
  historyDescription: {
    fontSize: 14,
    color: "#1F2937",
    fontWeight: "600",
    marginBottom: 2,
  },
  historyDate: {
    fontSize: 12,
    color: "#6B7280",
  },
  historyAmount: {
    alignItems: "flex-end",
  },
  amountText: {
    fontSize: 14,
    color: "#1F2937",
    fontWeight: "600",
    marginBottom: 2,
  },
  historyStatus: {
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  historyDivider: {
    backgroundColor: "#F1F5F9",
  },
  bottomSpacing: {
    height: 40,
  },
});