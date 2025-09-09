// apps/mobile/app/business/onboarding/plan.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { View, ScrollView, StyleSheet, Dimensions, KeyboardAvoidingView, Platform } from "react-native";
import {
  Text, Button, Surface, useTheme, Card, IconButton, RadioButton, Divider
} from "react-native-paper";
import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";

import { useSession, type BusinessTier } from "../../../context/SessionContext";
import { useOnboarding } from "../../../context/OnboardingContext";
import { getAuthStatus, meHeartbeat, clearSession } from "../../../lib/api/modules/auth";

const { width } = Dimensions.get("window");

interface Plan {
  id: string;
  name: string;
  tier: string;            // "level1" | "level2" | ...
  tierNumber: number;      // 1..6
  price: string;
  description: string;
  buttonText: string;
  buttonColor: string;
  features: Array<{ icon: string; text: string }>;
  isPopular?: boolean;
  requiresKYC?: boolean;
}

const plans: Plan[] = [
  { id:"eta", name:"Eta", tier:"level1", tierNumber:1, price:"Free - KSh 499",
    description:"For small businesses starting out", buttonText:"Start with Eta",
    buttonColor:"#1559C1",
    features:[{icon:"📅",text:"Single service booking"},{icon:"📱",text:"SMS alerts to customers"},{icon:"📊",text:"Basic analytics"},{icon:"💰",text:"M-Pesa integration"}],
    requiresKYC:false
  },
  { id:"zeta", name:"Zeta", tier:"level2", tierNumber:2, price:"KSh 499 - KSh 1,499",
    description:"For businesses with multiple services", buttonText:"Select plan ✓",
    buttonColor:"#FBC02D", isPopular:true,
    features:[{icon:"📅",text:"Multiple service calendar"},{icon:"👥",text:"Customer management"},{icon:"🔄",text:"Recurring appointments"},{icon:"📈",text:"Advanced reporting"}],
    requiresKYC:false
  },
  { id:"delta", name:"Delta", tier:"level3", tierNumber:3, price:"KSh 1,499 - KSh 3,999",
    description:"For teams with staff management needs", buttonText:"Select plan",
    buttonColor:"#F57C00",
    features:[{icon:"📊",text:"Team insights & analytics"},{icon:"👨‍💼",text:"Staff performance tracking"},{icon:"⚡",text:"Resource optimization"},{icon:"🏢",text:"Multi-location support"}],
    requiresKYC:true
  },
  { id:"gamma", name:"Gamma", tier:"level4", tierNumber:4, price:"KSh 4,999 - KSh 9,999",
    description:"For business chains & multi-location operations", buttonText:"Select plan",
    buttonColor:"#E53935",
    features:[{icon:"🗺",text:"Location routing"},{icon:"👤",text:"Role management"},{icon:"📄",text:"Daily reports"},{icon:"🏷",text:"Branded communications"}],
    requiresKYC:true
  },
  { id:"beta", name:"Beta", tier:"level5", tierNumber:5, price:"KSh 10,000 - KSh 19,000",
    description:"For institutions & organizations", buttonText:"Select plan",
    buttonColor:"#8E24AA",
    features:[{icon:"🧭",text:"Advanced role management"},{icon:"✅",text:"Approvals"},{icon:"📦",text:"Bulk operations"},{icon:"📊",text:"Advanced analytics & exports"}],
    requiresKYC:true
  },
  { id:"alpha", name:"Alpha", tier:"level6", tierNumber:6, price:"KSh 20,000+",
    description:"For government & enterprise", buttonText:"Select plan",
    buttonColor:"#546E7A",
    features:[{icon:"🔐",text:"SSO & audit logs"},{icon:"🔌",text:"API access"},{icon:"🏛",text:"Compliance features"},{icon:"📞",text:"Dedicated support"}],
    requiresKYC:true
  },
];

export default function ChoosePlan() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { updateBusiness, ready } = useSession();
  const { data: onboarding, setData, firstRequiredStep, goNext } = useOnboarding();

  // ---- Guard: must have Step-1 info + valid session ----
  const [guardChecking, setGuardChecking] = useState(true);
  const [guardError, setGuardError] = useState<string | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setGuardChecking(true);
        setGuardError(null);

        // Wait for session hydration to avoid false negatives
        if (!ready) return;

        // 1) Validate Step-1 payload presence
        const required: Array<keyof typeof onboarding> = [
          "businessName", "businessType", "email", "phone", "address",
        ];
        const missing = required.filter(
          (k) => !String((onboarding as any)?.[k] ?? "").trim()
        );
        if (mounted) setMissingFields(missing);

        // 2) Validate session (tokens present + heartbeat OK)
        const status = await getAuthStatus();
        if (!status.isAuthenticated) {
          if (mounted) setGuardError("You're not signed in or your session expired.");
          return;
        }
        try {
          const { user } = await meHeartbeat();
          const ok = !!(user?.id || user?.userId || user?._id);
          if (!ok && mounted) {
            setGuardError("You're not signed in or your session expired.");
          }
        } catch {
          if (mounted) setGuardError("You're not signed in or your session expired.");
        }
      } finally {
        if (mounted) setGuardChecking(false);
      }
    })();
    return () => { mounted = false; };
  }, [ready, onboarding]);

  const gated = guardChecking || !!guardError || missingFields.length > 0;

  // ---- Plans state ----
  // Fixed version with proper null checking
  const initialPlan = useMemo(() => {
    // Add null/undefined checks before accessing nested properties
    if (onboarding?.selectedPlan?.tier) {
      // Use non-null assertion since we know it exists from the if check
      return plans.find(p => p.tier === onboarding.selectedPlan!.tier) || null;
    }
    return null;
  }, [onboarding?.selectedPlan?.tier]);

  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(initialPlan);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');

  // Keep local selection in sync when user comes back to this screen
  useEffect(() => {
    setSelectedPlan(initialPlan);
  }, [initialPlan]);

  const handlePlanSelect = (plan: Plan) => {
    if (gated) return; // block selection until guard passes
    setSelectedPlan(plan);
    // Immediately persist chosen plan + tier + verification requirements
    const tierNumber = plan.tierNumber as BusinessTier;
    const verificationType = plan.requiresKYC ? ("FORMAL" as const) : ("INFORMAL" as const);
    setData({
      selectedPlan: { name: plan.name, tier: plan.tier, price: plan.price },
      tier: tierNumber,
      businessVerificationType: verificationType,
      needsKyc: !!plan.requiresKYC,
    });
  };

  const handleContinue = async () => {
    if (!selectedPlan || gated) return;

    // Re-check session right before continuing
    try {
      const { user } = await meHeartbeat();
      if (!(user?.id || user?.userId || user?._id)) throw new Error("Not authenticated");
    } catch (e) {
      setGuardError("Your session has expired. Please sign in to continue.");
      await clearSession();
      return;
    }

    setLoading(true);

    const tierNumber = selectedPlan.tierNumber as BusinessTier;
    const verificationType = selectedPlan.requiresKYC ? "FORMAL" as const : "INFORMAL" as const;

    // Persist to onboarding context
    setData({
      selectedPlan: { name: selectedPlan.name, tier: selectedPlan.tier, price: selectedPlan.price },
      tier: tierNumber,
      businessVerificationType: verificationType,
      needsKyc: !!selectedPlan.requiresKYC,
    });

    // Mirror to session context
    updateBusiness({
      selectedPlan: { name: selectedPlan.name, tier: selectedPlan.tier, price: selectedPlan.price },
      tier: tierNumber,
    });

    setLoading(false);

    // Route
    if (goNext) {
      goNext("step2");
    } else {
      if (tierNumber >= 3) router.push("/business/onboarding/kyc");
      else router.push("/business/onboarding/live-capture");
    }
  };

  const handleBack = () => router.back();
  const toggleViewMode = () => setViewMode(prev => prev === 'cards' ? 'list' : 'cards');

  // ---- UI helpers ----
  const getPreviousPlan = (tierNumber: number): string => {
    const previous = plans.find(p => p.tierNumber === tierNumber - 1);
    return previous?.name || "previous tier";
  };

  const GuardBanner = () => {
    if (!gated) return null;

    return (
      <Surface style={[styles.banner, { backgroundColor: "#FDECEA" }]} elevation={1}>
        {guardChecking ? (
          <Text style={{ color: "#B00020", fontWeight: "600" }}>Checking your session…</Text>
        ) : (
          <>
            {guardError && (
              <Text style={{ color: "#B00020", fontWeight: "700", marginBottom: 6 }}>
                {guardError}
              </Text>
            )}
            {missingFields.length > 0 && (
              <Text style={{ color: "#B00020", marginBottom: 8 }}>
                Missing info from Step 1: {missingFields.join(", ")}.
              </Text>
            )}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button
                mode="contained"
                onPress={() => router.replace("/business/onboarding")}
                style={{ borderRadius: 20, backgroundColor: "#1559C1" }}
              >
                Go to Step 1
              </Button>
              <Button
                mode="outlined"
                onPress={() => router.replace("/auth/login?next=/business/onboarding/plan")}
                style={{ borderRadius: 20 }}
                textColor="#1559C1"
              >
                Sign In
              </Button>
            </View>
          </>
        )}
      </Surface>
    );
  };

  // ---- Renderers ----
  const renderCardView = () => (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.plansContainer}
        style={styles.plansScroll}
        pointerEvents={gated ? "none" : "auto"}
      >
        {plans.map((plan) => (
          <Card
            key={plan.id}
            style={[
              styles.planCard,
              selectedPlan?.id === plan.id && styles.selectedCard,
              plan.isPopular && styles.popularCard,
              gated && { opacity: 0.5 },
            ]}
            onPress={() => handlePlanSelect(plan)}
          >
            <Card.Content style={styles.cardContent}>
              <View style={styles.planHeader}>
                <Text variant="headlineSmall" style={[styles.planName, { color: theme.colors.primary }]}>
                  {plan.name}
                </Text>
                {plan.requiresKYC ? (
                  <Text variant="labelSmall" style={[styles.kycBadge, { backgroundColor: "#E3F2FD", color: "#0D47A1" }]}>
                    Requires KYC
                  </Text>
                ) : (
                  <Text variant="labelSmall" style={[styles.kycBadge, { backgroundColor: "#E8F5E9", color: "#1B5E20" }]}>
                    Light KYC
                  </Text>
                )}
              </View>

              <Text variant="bodyMedium" style={[styles.planDescription, { color: theme.colors.onSurfaceVariant }]}>
                {plan.description}
              </Text>

              <Text variant="titleLarge" style={[styles.planPrice, { color: theme.colors.primary }]}>
                {plan.price}
              </Text>
              <Text variant="bodySmall" style={[styles.priceNote, { color: theme.colors.onSurfaceVariant }]}>
                per month plus transaction fees*
              </Text>

              <Button
                mode="contained"
                onPress={() => handlePlanSelect(plan)}
                disabled={gated}
                style={[styles.planButton, { backgroundColor: plan.buttonColor }]}
                contentStyle={styles.buttonContent}
                labelStyle={[
                  styles.buttonLabel,
                  { color: plan.buttonColor === "#FBC02D" ? theme.colors.primary : theme.colors.onPrimary },
                ]}
              >
                {selectedPlan?.id === plan.id ? "Selected ✓" : plan.buttonText}
              </Button>

              <View style={styles.featuresSection}>
                <Text variant="titleMedium" style={[styles.featuresTitle, { color: theme.colors.primary }]}>
                  {plan.name === "Eta" ? "Core features:" : `Everything in ${getPreviousPlan(plan.tierNumber)}, plus:`}
                </Text>
                {plan.features.map((f, i) => (
                  <View key={i} style={styles.featureRow}>
                    <Text style={styles.featureIcon}>{f.icon}</Text>
                    <Text variant="bodyMedium" style={[styles.featureText, { color: theme.colors.onSurfaceVariant }]}>
                      {f.text}
                    </Text>
                  </View>
                ))}
              </View>
            </Card.Content>
          </Card>
        ))}
      </ScrollView>

      <View style={styles.scrollIndicator}>
        <Text variant="bodyMedium" style={[styles.scrollText, { color: theme.colors.primary }]}>
          → Scroll to see all {plans.length} plans →
        </Text>
      </View>
    </>
  );

  const renderListView = () => (
    <RadioButton.Group
      onValueChange={(value) => {
        const plan = plans.find(p => p.id === value);
        if (plan) handlePlanSelect(plan);
      }}
      value={selectedPlan?.id || ""}
    >
      {plans.map((plan) => (
        <Card
          key={plan.id}
          mode={selectedPlan?.id === plan.id ? "elevated" : "outlined"}
          style={[
            styles.listPlanCard,
            selectedPlan?.id === plan.id && { borderColor: theme.colors.primary, borderWidth: 1.5 },
            gated && { opacity: 0.5 },
          ]}
          onPress={() => handlePlanSelect(plan)}
        >
          <Card.Content style={styles.listCardContent}>
            <View style={styles.listRow}>
              <RadioButton
                value={plan.id}
                status={selectedPlan?.id === plan.id ? "checked" : "unchecked"}
                onPress={() => handlePlanSelect(plan)}
                disabled={gated}
              />
              <View style={styles.listPlanInfo}>
                <View style={styles.listPlanHeader}>
                  <Text variant="titleMedium" style={{ fontWeight: "700" }}>{plan.name}</Text>
                  {plan.requiresKYC ? (
                    <Text variant="labelSmall" style={[styles.kycBadge, { backgroundColor: "#E3F2FD", color: "#0D47A1" }]}>
                      Requires KYC
                    </Text>
                  ) : (
                    <Text variant="labelSmall" style={[styles.kycBadge, { backgroundColor: "#E8F5E9", color: "#1B5E20" }]}>
                      Light KYC
                    </Text>
                  )}
                </View>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 4 }}>
                  {plan.price} • Tier {plan.tierNumber}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {plan.description}
                </Text>
              </View>
            </View>

            <View style={styles.compactFeatures}>
              {plan.features.slice(0, 2).map((f, i) => (
                <View key={i} style={styles.compactFeatureRow}>
                  <Text style={styles.featureIcon}>{f.icon}</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {f.text}
                  </Text>
                </View>
              ))}
              {plan.features.length > 2 && (
                <Text variant="bodySmall" style={{ color: theme.colors.primary, fontStyle: "italic" }}>
                  +{plan.features.length - 2} more features
                </Text>
              )}
            </View>
          </Card.Content>
        </Card>
      ))}
    </RadioButton.Group>
  );

  const keyboardVerticalOffset = Platform.OS === "ios" ? headerHeight : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        <ScrollView 
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.header}>
            <IconButton
              icon="arrow-left"
              size={24}
              iconColor={theme.colors.onBackground}
              onPress={handleBack}
              style={styles.backButton}
            />
            <View style={[styles.stepIndicator, { backgroundColor: theme.colors.primary }]}>
              <Text style={[styles.stepNumber, { color: theme.colors.onPrimary }]}>2</Text>
            </View>
            <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onBackground }]}>
              Step 2: Choose Your Plan
            </Text>
          </View>

          {/* Guard banner */}
          <GuardBanner />

          <Surface style={[styles.formContainer, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <View style={styles.formHeader}>
              <View style={styles.menuIcon}>
                <View style={[styles.menuLine, { backgroundColor: theme.colors.primary }]} />
                <View style={[styles.menuLine, { backgroundColor: theme.colors.primary }]} />
                <View style={[styles.menuLine, { backgroundColor: theme.colors.primary }]} />
              </View>
              <Text variant="titleLarge" style={[styles.formTitle, { color: theme.colors.primary }]}>
                Subscription Plans
              </Text>
              <IconButton
                icon={viewMode === "cards" ? "view-list" : "view-grid"}
                size={20}
                onPress={toggleViewMode}
                style={styles.viewToggle}
                disabled={gated}
              />
            </View>

            <Divider style={styles.divider} />

            {viewMode === "cards" ? renderCardView() : renderListView()}

            {selectedPlan && (
              <Surface style={[styles.selectedSummary, { backgroundColor: theme.colors.primaryContainer }]} elevation={2}>
                <Text variant="titleMedium" style={[styles.summaryTitle, { color: theme.colors.onPrimaryContainer }]}>
                  Selected: {selectedPlan.name} Plan
                </Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.onPrimaryContainer }}>
                  {selectedPlan.price} • Tier {selectedPlan.tierNumber}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onPrimaryContainer, opacity: 0.8 }}>
                  {selectedPlan.requiresKYC ? "Formal verification required" : "Light verification process"}
                </Text>
              </Surface>
            )}

            <Button
              mode="contained"
              onPress={handleContinue}
              loading={loading}
              disabled={loading || !selectedPlan || gated}
              style={[
                styles.continueButton,
                { backgroundColor: !gated && selectedPlan ? "#FBC02D" : theme.colors.surfaceDisabled },
              ]}
              contentStyle={styles.buttonContent}
              labelStyle={[styles.buttonLabel, { color: theme.colors.primary }]}
            >
              {loading ? "Processing..." : "Continue with Selected Plan"}
            </Button>
          </Surface>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 20 },
  header: { alignItems: "center", marginBottom: 20 },
  backButton: { position: "absolute", left: -10, top: 30 },
  stepIndicator: {
    width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", marginBottom: 12,
  },
  stepNumber: { fontSize: 18, fontWeight: "bold" },
  title: { fontWeight: "bold", textAlign: "center" },
  formContainer: { borderRadius: 20, padding: 24, marginBottom: 20 },
  formHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  menuIcon: { marginRight: 12 },
  menuLine: { width: 20, height: 3, marginBottom: 3, borderRadius: 1.5 },
  formTitle: { fontWeight: "bold", flex: 1 },
  viewToggle: { marginLeft: 8 },
  divider: { height: 2, backgroundColor: "#1559C1", marginBottom: 24 },

  // Guard banner
  banner: { borderRadius: 12, padding: 14, marginBottom: 12 },

  // Card View
  plansContainer: { paddingHorizontal: 8 },
  plansScroll: { marginBottom: 20 },
  planCard: { width: width * 0.7, marginHorizontal: 8, backgroundColor: "#FFFFFF" },
  selectedCard: { borderColor: "#1559C1", borderWidth: 2 },
  popularCard: { borderColor: "#FBC02D", borderWidth: 2 },
  cardContent: { padding: 20 },
  planHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  planName: { fontWeight: "bold", flex: 1 },
  planDescription: { marginBottom: 16, lineHeight: 20 },
  planPrice: { fontWeight: "bold", marginBottom: 4 },
  priceNote: { marginBottom: 20 },
  planButton: { borderRadius: 25, marginBottom: 20 },
  buttonContent: { paddingVertical: 8 },
  buttonLabel: { fontSize: 16, fontWeight: "600" },
  featuresSection: { marginTop: 8 },
  featuresTitle: { fontWeight: "600", marginBottom: 12 },
  featureRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  featureIcon: { fontSize: 16, marginRight: 8, width: 20 },
  featureText: { flex: 1, lineHeight: 20 },
  scrollIndicator: { alignItems: "center", marginBottom: 20 },
  scrollText: { fontWeight: "600" },

  // List View
  listPlanCard: { marginBottom: 12, borderRadius: 12 },
  listCardContent: { gap: 8 },
  listRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  listPlanInfo: { flex: 1 },
  listPlanHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  compactFeatures: { paddingLeft: 34, gap: 4 },
  compactFeatureRow: { flexDirection: "row", alignItems: "center", gap: 8 },

  // Common
  kycBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: "hidden", fontSize: 10, fontWeight: "600" },
  selectedSummary: { borderRadius: 12, padding: 16, marginBottom: 16 },
  summaryTitle: { fontWeight: "700", marginBottom: 4 },
  continueButton: { borderRadius: 25, marginTop: 16 },
});