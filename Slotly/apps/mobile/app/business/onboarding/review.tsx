"use client";

import { useMemo, useRef, useState } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import {
  Text,
  Button,
  Surface,
  useTheme,
  IconButton,
  Card,
  Divider,
  Chip,
  Checkbox,
  TextInput,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useOnboarding } from "../../../context/OnboardingContext";
import { redeemPromoCode } from "../../../lib/api/modules/subscription";

// Feature flag check
const PAYMENTS_ENABLED = (process.env.EXPO_PUBLIC_PAYMENTS_ENABLED ?? "true") !== "false";

export default function ReviewSubmit() {
  const theme = useTheme();
  const router = useRouter();
  const { data, routes, submitOnboarding, prevFrom, setData } = useOnboarding();

  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Promo state
  const [promoCode, setPromoCode] = useState(data.promoCode || "");
  const [promoApplying, setPromoApplying] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoSuccess, setPromoSuccess] = useState<boolean>(!!data.promoApplied);
  const [trialEndsOn, setTrialEndsOn] = useState<string | undefined>(data.trialEndsOn);

  const planName = data.selectedPlan?.name || "Level 1";
  const planTier = data.selectedPlan?.tier?.toUpperCase?.() || "LEVEL1";
  const planPrice = Number(data.selectedPlan?.price ?? 0); // KES
  const hasPromo = promoSuccess && trialEndsOn;

  const payoutSummary = useMemo(() => {
    switch (data.payoutType) {
      case "MPESA_PHONE":
        return `M-PESA (Phone): ${data.mpesaPhoneNumber || "-"}`;
      case "MPESA_TILL":
        return `M-PESA (Till): ${data.tillNumber || "-"}`;
      case "MPESA_PAYBILL":
        return `M-PESA (Paybill): ${data.paybillNumber || "-"} / Ref: ${data.accountRef || "-"}`;
      case "BANK":
        return `Bank: ${data.bankName || "-"} • ${data.accountName || "-"} • ${data.bankAccount || "-"}`;
      default:
        return "Not set";
    }
  }, [
    data.payoutType,
    data.mpesaPhoneNumber,
    data.tillNumber,
    data.paybillNumber,
    data.accountRef,
    data.bankName,
    data.bankAccount,
    data.accountName,
  ]);

  // --- Promo: apply & update totals atomically ---
  const applyPromo = async () => {
    if (!PAYMENTS_ENABLED) return; // Skip promo logic when payments are disabled
    
    setPromoError(null);
    if (!promoCode.trim()) {
      setPromoError("Enter a promo code");
      return;
    }
    if (promoSuccess) return;

    try {
      setPromoApplying(true);

      const plan = (data.selectedPlan?.tier ?? "LEVEL1").toUpperCase();
      // API returns the promo redemption result


       const res: any = await redeemPromoCode({ plan, code: promoCode.trim() });
     // Normalize trial end field names just in case backend differs
     const trialEndRaw =
       res?.trial?.endDate ??
        res?.trialEndDate ??
       res?.trial?.endsAt;
      if (!trialEndRaw) {
        setPromoError("Could not apply the code");
        return;
      }

      // For successful promo redemption, assume full discount and 30-day trial
      const discount = planPrice; // Full discount for promo codes
      const subtotal = planPrice;
      const total = Math.max(subtotal - discount, 0);

      // Calculate trial end date (30 days from now)
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 30);
      const endIso = trialEnd.toISOString();

      setPromoSuccess(true);
      setTrialEndsOn(endIso);

      // Persist everything for Step 6 atomically
      setData({
        promoCode: promoCode.trim(),
        promoApplied: true,
        trialEndsOn: endIso,
        billing: {
          planTier: plan,   // "LEVEL1" | "LEVEL2" | ...
          currency: "KES",
          totalDue: total,
          discountReason: "PROMO_TRIAL",
        },
        summaryTotals: {
          currency: "KES",
          subtotal,
          discount,
          total,
        },
      });
    } catch (e: any) {
      setPromoError(
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.message ||
        "Invalid or expired code"
      );
    } finally {
      setPromoApplying(false);
    }
  };

  // --- Submit: idempotent guard (no double clicks) + optional idempotency key ---
  const submittingRef = useRef(false);
  const handleSubmit = async () => {
    if (!agree) {
      setErr("Please agree to the terms to continue");
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;

    setErr(null);
    setLoading(true);

    try {
      const res = (await submitOnboarding?.()) ?? { success: true };

      if (!res.success) {
        setErr(res.error || "Submission failed");
        submittingRef.current = false;
        return;
      }

      // Navigate to Pending (webhook/background job updates Admin dashboard)
      router.replace("/business/onboarding/pending");
    } catch (error: any) {
      setErr("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const handleEdit = (href: any) => router.push(href);
  const handleTermsPress = () => {
    // open terms modal / link later
    console.log("Open Terms & Privacy Policy");
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.stepIndicator, { backgroundColor: theme.colors.primary }]}>
            <Text style={[styles.stepNumber, { color: theme.colors.onPrimary }]}>6</Text>
          </View>
          <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onBackground }]}>
            Step 6: Review & Submit
          </Text>
          <IconButton
            icon="arrow-left"
            size={22}
            iconColor={theme.colors.primary}
            onPress={() => router.push(prevFrom("step6"))}
            style={styles.backButton}
          />
        </View>

        {/* Main Form Container */}
        <Surface style={[styles.formContainer, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <View style={styles.formHeader}>
            <View style={styles.menuIcon}>
              <View style={[styles.menuLine, { backgroundColor: theme.colors.primary }]} />
              <View style={[styles.menuLine, { backgroundColor: theme.colors.primary }]} />
            </View>
            <Text variant="titleLarge" style={[styles.formTitle, { color: theme.colors.primary }]}>
              Review Application
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.primary }]} />

          {/* Business Info */}
          <Card style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <Text variant="titleLarge" style={styles.cardTitle}>Business Information</Text>
                <Button mode="text" onPress={() => handleEdit(routes.step1)}>Edit</Button>
              </View>
              <Divider style={{ marginVertical: 8 }} />
              <View style={styles.detailsGrid}>
                <View style={styles.row}>
                  <Text style={styles.label}>Name</Text>
                  <Text style={styles.value}>{data.businessName || "-"}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Type</Text>
                  <Text style={styles.value}>{data.businessType || "-"}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Email</Text>
                  <Text style={styles.value}>{data.email || "-"}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Phone</Text>
                  <Text style={styles.value}>{data.phone || "-"}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Address</Text>
                  <Text style={styles.value}>{data.address || "-"}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Description</Text>
                  <Text style={styles.value}>{data.description || "-"}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Location (lat,lng)</Text>
                  <Text style={styles.value}>
                    {data.latitude != null && data.longitude != null ? `${data.latitude}, ${data.longitude}` : "-"}
                  </Text>
                </View>
              </View>
            </Card.Content>
          </Card>

          {/* Promo Code - Only show if payments are enabled */}
          {PAYMENTS_ENABLED ? (
            <Card style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
              <Card.Content>
                <View style={styles.cardHeader}>
                  <Text variant="titleLarge" style={styles.cardTitle}>Promo Code</Text>
                </View>
                <Divider style={{ marginVertical: 8 }} />

                <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                  <TextInput
                    mode="outlined"
                    value={promoCode}
                    onChangeText={(t) => { setPromoCode(t); setPromoError(null); }}
                    placeholder="Enter code"
                    style={[styles.promoInput, { flex: 1 }]}
                    disabled={promoSuccess}
                    autoCapitalize="characters"
                  />
                  <Button
                    mode="contained"
                    onPress={applyPromo}
                    loading={promoApplying}
                    disabled={promoApplying || promoSuccess || !promoCode.trim()}
                    style={{ borderRadius: 10, backgroundColor: theme.colors.primary }}
                  >
                    {promoSuccess ? "Applied" : "Apply"}
                  </Button>
                </View>

                {promoError ? (
                  <Text style={{ color: theme.colors.error, marginBottom: 8, fontSize: 14 }}>
                    {promoError}
                  </Text>
                ) : null}

                <Card
                  mode="contained"
                  style={[styles.promoInfoCard, { backgroundColor: promoSuccess ? "#E8F5E9" : "#F5F5F5" }]}
                >
                  <Card.Content style={{ paddingVertical: 12 }}>
                    {promoSuccess ? (
                      <Text variant="bodyMedium" style={{ textAlign: "center", fontWeight: "600", color: "#1B5E20" }}>
                        ✅ Free trial activated! Ends on {trialEndsOn ? new Date(trialEndsOn).toDateString() : "–"}.
                      </Text>
                    ) : (
                      <Text variant="bodyMedium" style={{ textAlign: "center", fontWeight: "600" }}>
                        Have a promo code? Enter it above to activate your free trial.
                      </Text>
                    )}
                  </Card.Content>
                </Card>
              </Card.Content>
            </Card>
          ) : (
            <Card style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
              <Card.Content>
                <Text variant="titleMedium">Billing</Text>
                <Text variant="bodySmall" style={{ opacity: 0.8, marginTop: 8 }}>
                  Billing will be set up later. No payment is required to submit your application today.
                </Text>
              </Card.Content>
            </Card>
          )}

          {/* Plan & Trial */}
          <Card style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <Text variant="titleLarge" style={styles.cardTitle}>Plan & Trial</Text>
                <Button mode="text" onPress={() => handleEdit(routes.step2)}>Edit</Button>
              </View>
              <Divider style={{ marginVertical: 8 }} />
              <View style={styles.detailsGrid}>
                <View style={[styles.row, { alignItems: "center" }]}>
                  <Text style={styles.label}>Selected Plan</Text>
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                    <Chip icon="star" compact>{planName}</Chip>
                    <Chip compact>{planTier}</Chip>
                  </View>
                </View>
                {PAYMENTS_ENABLED && (
                  <View style={styles.row}>
                    <Text style={styles.label}>Promo</Text>
                    <Text style={[styles.value, { color: hasPromo ? "#1B5E20" : theme.colors.onSurfaceVariant }]}>
                      {hasPromo
                        ? `Applied • Ends ${new Date(trialEndsOn!).toDateString()}`
                        : promoCode && !promoSuccess
                          ? `Entered (${promoCode}) — not applied`
                          : "None"}
                    </Text>
                  </View>
                )}
              </View>
            </Card.Content>
          </Card>

          {/* Billing Summary (totals) - Only show if payments are enabled */}
          {PAYMENTS_ENABLED && (
            <Card style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
              <Card.Content>
                <View style={styles.cardHeader}>
                  <Text variant="titleLarge" style={styles.cardTitle}>Billing Summary</Text>
                </View>
                <Divider style={{ marginVertical: 8 }} />
                <View style={styles.detailsGrid}>
                  <View style={styles.row}>
                    <Text style={styles.label}>Subtotal</Text>
                    <Text style={styles.value}>KES {Number(data.summaryTotals?.subtotal ?? planPrice).toLocaleString()}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>Discount</Text>
                    <Text style={styles.value}>− KES {Number(data.summaryTotals?.discount ?? 0).toLocaleString()}</Text>
                  </View>
                  <Divider />
                  <View style={styles.row}>
                    <Text style={[styles.label, { fontWeight: "700" }]}>Total Due</Text>
                    <Text style={[styles.value, { fontWeight: "700" }]}>
                      KES {Number(data.summaryTotals?.total ?? (hasPromo ? 0 : planPrice)).toLocaleString()}
                    </Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          )}

          {/* Payout Method */}
          <Card style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <Text variant="titleLarge" style={styles.cardTitle}>Payout Method</Text>
                <Button mode="text" onPress={() => handleEdit(routes.step5)}>Edit</Button>
              </View>
              <Divider style={{ marginVertical: 8 }} />
              <View style={styles.detailsGrid}>
                <View style={styles.row}>
                  <Text style={styles.label}>Method</Text>
                  <Text style={styles.value}>{payoutSummary}</Text>
                </View>
              </View>
            </Card.Content>
          </Card>

          {/* Terms */}
          <View style={styles.termsContainer}>
            <View style={styles.termsRow}>
              <Checkbox
                status={agree ? "checked" : "unchecked"}
                onPress={() => setAgree(!agree)}
                color={theme.colors.primary}
              />
              <Text
                variant="bodyMedium"
                style={[styles.termsText, { color: theme.colors.primary }]}
                onPress={handleTermsPress}
              >
                By submitting, you agree to the Terms & Privacy Policy and confirm all information is accurate
              </Text>
            </View>
          </View>

          {err ? <Text style={[styles.errorText, { color: theme.colors.error }]}>{err}</Text> : null}

          {/* Submit Button */}
          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading || !agree}
            style={[styles.submitButton, { backgroundColor: agree ? "#FBC02D" : theme.colors.surfaceDisabled }]}
            contentStyle={styles.buttonContent}
            labelStyle={[styles.buttonLabel, { color: theme.colors.primary }]}
          >
            Submit for Verification
          </Button>
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 20 },
  header: { alignItems: "center", marginBottom: 20, position: "relative" },
  stepIndicator: {
    width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", marginBottom: 12
  },
  stepNumber: { fontSize: 18, fontWeight: "bold" },
  title: { fontWeight: "bold", textAlign: "center" },
  backButton: { position: "absolute", left: -10, top: 50 },
  formContainer: { borderRadius: 20, padding: 24, marginBottom: 20 },
  formHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  menuIcon: { marginRight: 12 },
  menuLine: { width: 20, height: 3, marginBottom: 3, borderRadius: 1.5 },
  formTitle: { fontWeight: "bold" },
  divider: { height: 2, marginBottom: 24 },
  summaryCard: { marginBottom: 16, borderRadius: 12, elevation: 1 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontWeight: "700" },
  detailsGrid: { gap: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 6, gap: 10 },
  label: { fontWeight: "600", flex: 1 },
  value: { fontWeight: "400", flex: 2, textAlign: "right" },
  termsContainer: { marginBottom: 16 },
  termsRow: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 8 },
  termsText: { flex: 1, marginLeft: 8, lineHeight: 20, fontWeight: "600", textDecorationLine: "underline" },
  errorText: { textAlign: "center", marginBottom: 16, fontSize: 14, fontWeight: "500" },
  submitButton: { borderRadius: 25, marginTop: 8 },
  buttonContent: { paddingVertical: 8 },
  buttonLabel: { fontSize: 16, fontWeight: "600" },
  promoInput: { backgroundColor: "transparent" },
  promoInfoCard: { borderRadius: 12, marginTop: 6 },
});