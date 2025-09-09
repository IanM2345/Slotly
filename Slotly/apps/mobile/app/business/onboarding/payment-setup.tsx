"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from "react-native";
import {
  Text,
  Button,
  Surface,
  useTheme,
  IconButton,
  Card,
  TextInput,
  RadioButton,
} from "react-native-paper";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../../lib/api/client";
import { attachPayoutMethod, prewarmPaymentsAttach } from "../../../lib/api/modules/payment";
import { useSession } from "../../../context/SessionContext";
import { getAuthStatus, meHeartbeat, clearSession } from "../../../lib/api/modules/auth";
import { useOnboarding } from "../../../context/OnboardingContext";

type PayoutType = "MPESA_PHONE" | "MPESA_TILL" | "MPESA_PAYBILL" | "BANK";

type OptionDef = {
  type: PayoutType;
  title: string;
  subtitle: string;
};

const OPTIONS: OptionDef[] = [
  { type: "MPESA_PHONE",   title: "M-PESA (Phone)",   subtitle: "Pay owner's phone" },
  { type: "MPESA_TILL",    title: "M-PESA (Till)",    subtitle: "Pay to Till" },
  { type: "MPESA_PAYBILL", title: "M-PESA (Paybill)", subtitle: "Paybill + Account Ref" },
  { type: "BANK",          title: "Bank Transfer",     subtitle: "Pay to bank account" },
];

export default function PaymentSetup() {
  const router = useRouter();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { data, setData, updateKycSection, firstRequiredStep, goNext } = useOnboarding();
  const { ready } = useSession();

  const [payoutType, setPayoutType] = useState<PayoutType>(
    (data.payoutType as PayoutType) || "MPESA_PHONE"
  );

  // fields
  const [mpesaPhoneNumber, setMpesaPhoneNumber] = useState(data.mpesaPhoneNumber || "");
  const [tillNumber, setTillNumber] = useState(data.tillNumber || "");
  const [paybillNumber, setPaybillNumber] = useState(data.paybillNumber || "");
  const [accountRef, setAccountRef] = useState(data.accountRef || "");
  const [bankName, setBankName] = useState(data.bankName || "");
  const [bankAccount, setBankAccount] = useState(data.bankAccount || "");
  const [accountName, setAccountName] = useState(data.accountName || "");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [guardChecking, setGuardChecking] = useState(true);
  const [guardError, setGuardError] = useState<string | null>(null);

  // Pre-warm the API route to avoid first-compile timeout
  useEffect(() => {
    if (!ready) return;
    prewarmPaymentsAttach().catch(() => {});
  }, [ready]);

  // Entry guard: session must be valid, and previous steps must be satisfied
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setGuardChecking(true);
        setGuardError(null);
        if (!ready) return; // wait for session hydration

        // 1) Session has tokens and hasn't expired (weekly window)
        const status = await getAuthStatus();
        if (!status.isAuthenticated) {
          if (mounted) setGuardError("You're not signed in or your session expired.");
          return;
        }

        // 2) Heartbeat returns a user object (reads the same token store)
         const { user } = await meHeartbeat();
        if (!(user?.id || user?.userId || user?._id)) throw new Error("Not authenticated");

    

        // 3) Don't allow direct entry if earlier steps aren't complete
        const expected = "/business/onboarding/payment-setup";
        const mustGo = firstRequiredStep();
        if (mustGo !== expected) {
          router.replace(mustGo);
          return;
        }
        if (!data.selectedPlan) {
          router.replace("/business/onboarding/plan");
          return;
        }
      } catch {
        if (mounted) setGuardError("You're not signed in or your session expired.");
      } finally {
        if (mounted) setGuardChecking(false);
      }
    })();
    return () => { mounted = false; };
  }, [ready, data.selectedPlan]);

  // --- Layout: responsive grid (no vertical text collapse) ---
  const pagePad = 20;
  const gap = 10;
  const numCols = width >= 700 ? 3 : 2;
  const cardWidth = (width - pagePad * 2 - (numCols - 1) * gap) / numCols;

  // --- Validation ---
  const isValid = useMemo(() => {
    switch (payoutType) {
      case "MPESA_PHONE":
        return !!mpesaPhoneNumber.trim();
      case "MPESA_TILL":
        return !!tillNumber.trim();
      case "MPESA_PAYBILL":
        return !!paybillNumber.trim() && !!accountRef.trim();
      case "BANK":
        return !!bankName.trim() && !!bankAccount.trim() && !!accountName.trim();
    }
  }, [
    payoutType,
    mpesaPhoneNumber,
    tillNumber,
    paybillNumber,
    accountRef,
    bankName,
    bankAccount,
    accountName,
  ]);

  // Helper to format display text for the payout method
  const formatPayoutDisplay = () => {
    switch (payoutType) {
      case "MPESA_PHONE":
        return `M-PESA Phone: ${maskPhone(mpesaPhoneNumber)}`;
      case "MPESA_TILL":
        return `M-PESA Till: ${tillNumber}`;
      case "MPESA_PAYBILL":
        return `M-PESA Paybill: ${paybillNumber} (${accountRef})`;
      case "BANK":
        return `${bankName}: ${maskAccount(bankAccount)}${accountName ? ` (${accountName})` : ""}`;
      default:
        return "";
    }
  };

  // --- Actions ---
  const handleContinue = async () => {
    if (!isValid || guardChecking || guardError) {
      setErr("Please fill the required fields for your chosen payout method.");
      return;
    }
    setErr(null);
    setLoading(true);

    try {
      // Re-check auth just before hitting payments
      const { user } = await meHeartbeat();
      if (!(user?.id || user?.userId || user?._id)) throw new Error("Not authenticated");

      // 1) persist local fields
      setData({
        payoutType,
        mpesaPhoneNumber: payoutType === "MPESA_PHONE" ? mpesaPhoneNumber.trim() : undefined,
        tillNumber: payoutType === "MPESA_TILL" ? tillNumber.trim() : undefined,
        paybillNumber: payoutType === "MPESA_PAYBILL" ? paybillNumber.trim() : undefined,
        accountRef: payoutType === "MPESA_PAYBILL" ? accountRef.trim() : undefined,
        bankName: payoutType === "BANK" ? bankName.trim() : undefined,
        bankAccount: payoutType === "BANK" ? bankAccount.trim() : undefined,
        accountName: payoutType === "BANK" ? accountName.trim() : undefined,
      });

      // 2) call backend stub to get a tokenRef (very fast after first compile)
      const payload =
        payoutType === "MPESA_PHONE"
          ? { type: "MPESA_PHONE", msisdn: mpesaPhoneNumber }
          : payoutType === "MPESA_TILL"
          ? { type: "MPESA_TILL", tillNumber: tillNumber }
          : payoutType === "MPESA_PAYBILL"
          ? { type: "MPESA_PAYBILL", paybillNumber, accountRef }
          : { type: "BANK", bankName, accountNumber: bankAccount, accountName };

      const token = await attachPayoutMethod(payload, { timeout: 25000 });

      // store token/display in onboarding context for review step
      setData({
        payoutToken: token?.tokenRef || token?.token || token?.id,
        payoutDisplay: token?.display || formatPayoutDisplay(),
      });

      updateKycSection("payment", true);
      // Proceed to review (or use goNext if you prefer centralized routing)
      router.push("/business/onboarding/review");
    } catch (e: any) {
      const status = Number(e?.status || e?.response?.status || 0);
      if (status === 401) {
        setErr("Your session has expired. Please sign in to continue.");
        await clearSession();
        router.replace("/auth/login?next=/business/onboarding/payment-setup");
        return;
      }
      setErr(e?.message || "Network error. Check your connection and try again.");
      if (__DEV__) {
        console.log("attachPayoutMethod error:", e);
        console.log("API baseURL:", api?.defaults?.baseURL);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => router.back();

  // --- UI helpers ---
  const methodCard = (opt: OptionDef) => {
    const selected = payoutType === opt.type;
    return (
      <Card
        key={opt.type}
        mode={selected ? "elevated" : "outlined"}
        onPress={() => setPayoutType(opt.type)}
        style={[
          styles.methodCard,
          {
            width: cardWidth,
            borderColor: selected ? theme.colors.primary : theme.colors.outline,
            backgroundColor: selected ? "#F5F9FF" : theme.colors.surface,
          },
        ]}
      >
        <Card.Content style={styles.methodContent}>
          <RadioButton
            value={opt.type}
            status={selected ? "checked" : "unchecked"}
            onPress={() => setPayoutType(opt.type)}
          />
          <View style={styles.methodTextCol}>
            <Text
              variant="titleMedium"
              style={styles.methodTitle}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {opt.title}
            </Text>
            <Text
              variant="bodySmall"
              style={styles.methodSubtitle}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {opt.subtitle}
            </Text>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingHorizontal: pagePad }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <IconButton icon="arrow-left" size={22} iconColor={theme.colors.primary} onPress={handleBack} />
            <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onBackground }]}>
              Step 5: Payment Setup
            </Text>
          </View>

          <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
            {guardChecking ? (
              <Text style={{ marginBottom: 8 }}>Checking your session…</Text>
            ) : guardError ? (
              <Text style={{ marginBottom: 8, color: theme.colors.error }}>{guardError}</Text>
            ) : null}
            
            <Text variant="titleLarge" style={{ fontWeight: "700", color: theme.colors.primary, marginBottom: 8 }}>
              Choose payout method
            </Text>

            {/* Responsive grid of options */}
            <View style={[styles.grid, { gap }]}>
              {OPTIONS.map(methodCard)}
            </View>

            <View style={styles.separator} />

            {/* Dynamic fields */}
            {payoutType === "MPESA_PHONE" && (
              <View style={styles.inputSection}>
                <Text variant="titleSmall" style={styles.inputLabel}>M-PESA Phone</Text>
                <TextInput
                  mode="outlined"
                  keyboardType="phone-pad"
                  value={mpesaPhoneNumber}
                  onChangeText={setMpesaPhoneNumber}
                  placeholder="e.g. 0712 345 678"
                  style={styles.input}
                />
              </View>
            )}

            {payoutType === "MPESA_TILL" && (
              <View style={styles.inputSection}>
                <Text variant="titleSmall" style={styles.inputLabel}>Till Number</Text>
                <TextInput
                  mode="outlined"
                  keyboardType="number-pad"
                  value={tillNumber}
                  onChangeText={setTillNumber}
                  placeholder="e.g. 123456"
                  style={styles.input}
                />
              </View>
            )}

            {payoutType === "MPESA_PAYBILL" && (
              <>
                <View style={styles.inputSection}>
                  <Text variant="titleSmall" style={styles.inputLabel}>Paybill Number</Text>
                  <TextInput
                    mode="outlined"
                    keyboardType="number-pad"
                    value={paybillNumber}
                    onChangeText={setPaybillNumber}
                    placeholder="e.g. 654321"
                    style={styles.input}
                  />
                </View>
                <View style={styles.inputSection}>
                  <Text variant="titleSmall" style={styles.inputLabel}>Account Reference</Text>
                  <TextInput
                    mode="outlined"
                    value={accountRef}
                    onChangeText={setAccountRef}
                    placeholder="e.g. SLOTLY-123"
                    style={styles.input}
                  />
                </View>
              </>
            )}

            {payoutType === "BANK" && (
              <>
                <View style={styles.inputSection}>
                  <Text variant="titleSmall" style={styles.inputLabel}>Bank Name</Text>
                  <TextInput
                    mode="outlined"
                    value={bankName}
                    onChangeText={setBankName}
                    placeholder="e.g. KCB"
                    style={styles.input}
                  />
                </View>
                <View style={styles.inputSection}>
                  <Text variant="titleSmall" style={styles.inputLabel}>Account Number</Text>
                  <TextInput
                    mode="outlined"
                    keyboardType="number-pad"
                    value={bankAccount}
                    onChangeText={setBankAccount}
                    placeholder="e.g. 0123456789"
                    style={styles.input}
                  />
                </View>
                <View style={styles.inputSection}>
                  <Text variant="titleSmall" style={styles.inputLabel}>Account Name</Text>
                  <TextInput
                    mode="outlined"
                    value={accountName}
                    onChangeText={setAccountName}
                    placeholder="Business LTD"
                    style={styles.input}
                  />
                </View>
              </>
            )}

            {err ? (
              <Text style={[styles.errText, { color: theme.colors.error }]}>
                {err}
              </Text>
            ) : null}

            <Button
              mode="contained"
              onPress={handleContinue}
              loading={loading}
              disabled={loading || !isValid || guardChecking || !!guardError}
              style={[styles.continueButton, { backgroundColor: theme.colors.primary }]}
              contentStyle={styles.buttonContent}
              labelStyle={[styles.buttonLabel, { color: theme.colors.onPrimary }]}
            >
              Continue
            </Button>
          </Surface>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ---------- helpers ---------- */

function maskPhone(p: string) {
  const s = (p || "").replace(/\s+/g, "");
  if (!s) return "";
  // show last 3 digits only
  return `+2547••• ••${s.slice(-3)}`;
}

function maskAccount(a: string) {
  const s = (a || "").replace(/\s+/g, "");
  if (!s) return "";
  return `•••• ${s.slice(-4)}`;
}

/* ---------- styles ---------- */

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingVertical: 20 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  title: { fontWeight: "700" },

  card: { borderRadius: 16, padding: 16, gap: 10 },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "stretch",
    justifyContent: "space-between",
  },
  methodCard: { borderWidth: 2, marginBottom: 10, borderRadius: 12 },
  methodContent: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12 },
  methodTextCol: { flex: 1, minWidth: 0 }, // minWidth=0 so ellipsis works
  methodTitle: { fontWeight: "700" },
  methodSubtitle: { fontWeight: "500", opacity: 0.8 },

  separator: { height: 1, backgroundColor: "#eee", marginVertical: 8 },

  inputSection: { marginBottom: 12 },
  inputLabel: { fontWeight: "600", marginBottom: 6 },
  input: { backgroundColor: "transparent" },

  errText: { marginTop: 6 },

  continueButton: { borderRadius: 25, marginTop: 6 },
  buttonContent: { paddingVertical: 8 },
  buttonLabel: { fontSize: 16, fontWeight: "600" },
});