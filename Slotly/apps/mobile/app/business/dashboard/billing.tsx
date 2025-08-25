// apps/mobile/app/business/dashboard/billing.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { View, ScrollView, StyleSheet, Alert, Platform, Linking } from "react-native";
import {
  Text,
  Surface,
  ActivityIndicator,
  IconButton,
  Button,
  useTheme,
  Switch,
  Divider,
  Chip,
} from "react-native-paper";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Sentry from "sentry-expo";
import { useTier } from "../../../context/TierContext";
import { VerificationGate } from "../../../components/VerificationGate";
import { Section } from "../../../components/Section";
import type { BusinessTier } from "../../../lib/types";

// Updated API imports
import { getBilling, startPlanCheckout } from "../../../lib/api/modules/manager";

type Subscription = {
  id: string;
  businessId: string;
  plan: "LEVEL_1" | "LEVEL_2" | "LEVEL_3" | "LEVEL_4" | "LEVEL_5" | "LEVEL_6";
  startDate: string;
  endDate: string;
  isActive: boolean;
  amount?: number | null;
};

type Payment = {
  id: string;
  amount: number;
  currency: string;
  method: string;
  status: "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED";
  txRef?: string | null;
  provider?: string | null;
  providerPaymentId?: string | null;
  createdAt: string;
};

const planLabel: Record<Subscription["plan"], string> = {
  LEVEL_1: "Starter",
  LEVEL_2: "Basic",
  LEVEL_3: "Pro",
  LEVEL_4: "Business",
  LEVEL_5: "Enterprise",
  LEVEL_6: "Premium",
};

const tierToPlan: Record<BusinessTier, Subscription["plan"]> = {
  level1: "LEVEL_1",
  level2: "LEVEL_2",
  level3: "LEVEL_3",
  level4: "LEVEL_4",
  level5: "LEVEL_5",
  level6: "LEVEL_6",
};

const planToTier: Record<Subscription["plan"], BusinessTier> = {
  LEVEL_1: "level1",
  LEVEL_2: "level2",
  LEVEL_3: "level3",
  LEVEL_4: "level4",
  LEVEL_5: "level5",
  LEVEL_6: "level6",
};

export default function BillingScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { tier, setTier } = useTier();

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<Subscription["plan"]>("LEVEL_1");
  const [planLabelText, setPlanLabelText] = useState<string>("Starter");
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [autoRenew, setAutoRenew] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await getBilling();
      
      const currentPlan: Subscription["plan"] = (data?.plan as Subscription["plan"]) || "LEVEL_1";
      setPlan(currentPlan);
      setPlanLabelText(data?.planLabel || planLabel[currentPlan] || "Starter");
      setSubscription(data?.subscription || null);
      setPayments(Array.isArray(data?.payments) ? data.payments : []);

      // Sync TierContext with backend plan
      const uiTier = planToTier[currentPlan];
      if (uiTier && uiTier !== tier) {
        setTier(uiTier);
      }
    } catch (e: any) {
      Sentry.Native.captureException(e);
      console.error("Load billing failed:", e?.message || e);
      
      // Set defaults on error
      setPlan("LEVEL_1");
      setPlanLabelText("Starter");
      setSubscription(null);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const statusText = useMemo(() => {
    if (!subscription) return "NO SUBSCRIPTION";
    if (subscription.isActive) return "ACTIVE";
    const end = subscription.endDate ? new Date(subscription.endDate) : null;
    if (end && end < new Date()) return "PAST_DUE";
    return "INACTIVE";
  }, [subscription]);

  const nextBillingDate = useMemo(() => 
    subscription?.endDate ? new Date(subscription.endDate) : null, 
    [subscription]
  );

  const formatDate = (d?: Date | null) =>
    d ? d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "—";

  const getStatusColor = (s: string) => {
    switch (s) {
      case "ACTIVE":
      case "SUCCESS":
        return "#2E7D32";
      case "PENDING":
      case "INACTIVE":
        return "#FBC02D";
      case "FAILED":
      case "PAST_DUE":
      case "REFUNDED":
        return "#C62828";
      default:
        return "#6B7280";
    }
  };

  async function handlePlanUpgrade(targetPlan: Subscription["plan"]) {
    try {
      setUpgrading(true);
      const res = await startPlanCheckout({ targetPlan });
      
      if (res?.checkoutLink) {
        await WebBrowser.openBrowserAsync(res.checkoutLink);
      } else {
        Alert.alert("Upgrade Requested", "Your account manager will contact you to complete the upgrade.");
      }
      
      // Refresh billing data after upgrade attempt
      await load();
    } catch (e: any) {
      Sentry.Native.captureException(e);
      Alert.alert("Upgrade Error", e?.response?.data?.error || "Failed to initiate upgrade");
    } finally {
      setUpgrading(false);
    }
  }

  async function handlePlanSelect(selectedTier: BusinessTier) {
    const targetPlan = tierToPlan[selectedTier];
    if (!targetPlan || targetPlan === plan) return;
    
    await handlePlanUpgrade(targetPlan);
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading billing information…</Text>
      </View>
    );
  }

  return (
    <VerificationGate>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <IconButton 
            icon="arrow-left" 
            size={24} 
            iconColor={theme.colors.onSurface} 
            onPress={() => router.back()} 
          />
          <Text style={styles.title}>Billing</Text>
          <Chip compact>{planLabelText}</Chip>
        </View>

        {/* Current Plan */}
        <Section title="Current Plan">
          <Surface style={styles.currentPlanCard} elevation={2}>
            <View style={styles.planHeader}>
              <View style={styles.planInfo}>
                <Text style={styles.planName}>{planLabelText}</Text>
                <Text style={styles.planPrice}>
                  {subscription?.amount && subscription.amount > 0 
                    ? `KSh ${subscription.amount.toLocaleString()}/month` 
                    : "Free"
                  }
                </Text>
              </View>
              <View style={styles.planStatus}>
                <Text style={[styles.statusText, { color: getStatusColor(statusText) }]}>
                  {statusText}
                </Text>
              </View>
            </View>

            <View style={styles.planDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Start Date:</Text>
                <Text style={styles.detailValue}>
                  {subscription?.startDate 
                    ? new Date(subscription.startDate).toLocaleDateString() 
                    : "—"
                  }
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Next renewal:</Text>
                <Text style={styles.detailValue}>{formatDate(nextBillingDate)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Auto-renew:</Text>
                <Switch 
                  value={autoRenew} 
                  onValueChange={() => setAutoRenew((v) => !v)} 
                />
              </View>
            </View>

            <View style={styles.planActions}>
              <Button 
                mode="contained" 
                onPress={() => handlePlanUpgrade("LEVEL_2")} 
                style={styles.planActionBtn}
                loading={upgrading}
                disabled={plan === "LEVEL_6"} // Don't show upgrade if already on highest plan
              >
                {plan === "LEVEL_6" ? "Max Plan" : "Upgrade"}
              </Button>
              <Button
                mode="outlined"
                onPress={() => router.push("/business/dashboard/reports")}
                style={styles.planActionBtn}
              >
                View Reports
              </Button>
            </View>
          </Surface>
        </Section>

        {/* Available Plans */}
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
            ).map((p) => {
              const isCurrentPlan = tierToPlan[p.tier] === plan;
              return (
                <Surface
                  key={p.tier}
                  style={[styles.planCard, isCurrentPlan && styles.currentPlanHighlight]}
                  elevation={isCurrentPlan ? 4 : 2}
                >
                  <View style={styles.planCardHeader}>
                    <Text style={styles.planCardName}>{p.name}</Text>
                    <Text style={styles.planCardPrice}>
                      {p.price === 0 ? "Free" : `KSh ${p.price.toLocaleString()}/mo`}
                    </Text>
                  </View>
                  <Button
                    mode={isCurrentPlan ? "outlined" : "contained"}
                    onPress={() => handlePlanSelect(p.tier)}
                    style={[styles.selectPlanBtn, isCurrentPlan && styles.currentPlanBtn]}
                    disabled={isCurrentPlan}
                  >
                    {isCurrentPlan ? "CURRENT PLAN" : "Select Plan"}
                  </Button>
                </Surface>
              );
            })}
          </View>
        </Section>

        {/* Payment History */}
        <Section title="Payment History">
          <Surface style={styles.historyCard} elevation={2}>
            {payments.length === 0 ? (
              <View style={{ padding: 16 }}>
                <Text style={{ color: "#6B7280" }}>No subscription payments yet.</Text>
              </View>
            ) : (
              payments.map((payment, idx) => (
                <View key={payment.id}>
                  <View style={styles.historyRow}>
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyDescription}>
                        Subscription payment
                      </Text>
                      <Text style={styles.historyDate}>
                        {new Date(payment.createdAt).toLocaleString()}
                      </Text>
                      <Text style={styles.paymentMethod}>
                        via {payment.method} • {payment.provider || 'Unknown'}
                      </Text>
                    </View>
                    <View style={styles.historyAmount}>
                      <Text style={styles.amountText}>
                        {(payment.amount / 100).toLocaleString()} {payment.currency || "KES"}
                      </Text>
                      <Chip 
                        compact 
                        mode="outlined"
                        style={{ backgroundColor: getStatusColor(payment.status) + '10' }}
                        textStyle={{ color: getStatusColor(payment.status) }}
                      >
                        {payment.status}
                      </Chip>
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1559C1",
    flex: 1,
    marginLeft: 8,
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
  planCardHeader: {
    marginBottom: 16,
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
    alignItems: "flex-start",
    padding: 16,
  },
  historyInfo: {
    flex: 1,
    marginRight: 16,
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
    marginBottom: 2,
  },
  paymentMethod: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  historyAmount: {
    alignItems: "flex-end",
    gap: 4,
  },
  amountText: {
    fontSize: 14,
    color: "#1F2937",
    fontWeight: "600",
  },
  historyDivider: {
    backgroundColor: "#F1F5F9",
  },
  bottomSpacing: {
    height: 40,
  },
});