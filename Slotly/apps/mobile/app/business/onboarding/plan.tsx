"use client";

import { useState } from "react";
import { View, ScrollView, StyleSheet, Dimensions } from "react-native";
import { Text, Button, Surface, useTheme, Card, IconButton } from "react-native-paper";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useSession, type BusinessTier } from "../../../context/SessionContext";
import { useOnboarding } from "../../../context/OnboardingContext";

const { width } = Dimensions.get("window");

interface Plan {
  id: string;
  name: string;
  tier: string; // "level1" | "level2" | ...
  price: string;
  description: string;
  buttonText: string;
  buttonColor: string;
  features: Array<{ icon: string; text: string }>;
  isPopular?: boolean;
}

const plans: Plan[] = [
  {
    id: "eta",
    name: "Eta",
    tier: "level1",
    price: "Free - KSh 499",
    description: "For small businesses starting out",
    buttonText: "Start with Eta",
    buttonColor: "#1559C1",
    features: [
      { icon: "📅", text: "Single service booking" },
      { icon: "📱", text: "SMS alerts to customers" },
      { icon: "📊", text: "Basic analytics" },
      { icon: "💰", text: "M-Pesa integration" },
    ],
  },
  {
    id: "zeta",
    name: "Zeta",
    tier: "level2",
    price: "KSh 499 - KSh 1,499",
    description: "For businesses with multiple services",
    buttonText: "Select plan ✓",
    buttonColor: "#FBC02D",
    isPopular: true,
    features: [
      { icon: "📅", text: "Multiple service calendar" },
      { icon: "👥", text: "Customer management" },
      { icon: "🔄", text: "Recurring appointments" },
      { icon: "📈", text: "Advanced reporting" },
    ],
  },
  {
    id: "delta",
    name: "Delta",
    tier: "level3",
    price: "KSh 1,499 - KSh 3,999",
    description: "For teams with staff management needs",
    buttonText: "Select plan",
    buttonColor: "#F57C00",
    features: [
      { icon: "📊", text: "Team insights & analytics" },
      { icon: "👨‍💼", text: "Staff performance tracking" },
      { icon: "⚡", text: "Resource optimization" },
      { icon: "🏢", text: "Multi-location support" },
    ],
  },
  // NEW: Gamma, Beta, Alpha (tiers 4–6)
  {
    id: "gamma",
    name: "Gamma",
    tier: "level4",
    price: "KSh 4,999 - KSh 9,999",
    description: "For business chains & multi-location operations",
    buttonText: "Select plan",
    buttonColor: "#E53935",
    features: [
      { icon: "🗺️", text: "Location routing" },
      { icon: "👤", text: "Role management" },
      { icon: "📄", text: "Daily reports" },
      { icon: "🏷️", text: "Branded communications" },
    ],
  },
  {
    id: "beta",
    name: "Beta",
    tier: "level5",
    price: "KSh 10,000 - KSh 19,000",
    description: "For institutions & organizations",
    buttonText: "Select plan",
    buttonColor: "#8E24AA",
    features: [
      { icon: "🧭", text: "Advanced role management" },
      { icon: "✅", text: "Approvals" },
      { icon: "📦", text: "Bulk operations" },
      { icon: "📊", text: "Advanced analytics & exports" },
    ],
  },
  {
    id: "alpha",
    name: "Alpha",
    tier: "level6",
    price: "KSh 20,000+",
    description: "For government & enterprise",
    buttonText: "Select plan",
    buttonColor: "#546E7A",
    features: [
      { icon: "🔐", text: "SSO & audit logs" },
      { icon: "🔌", text: "API access" },
      { icon: "🏛️", text: "Compliance features" },
      { icon: "📞", text: "Dedicated support" },
    ],
  },
];

export default function ChoosePlan() {
  const router = useRouter();
  const theme = useTheme();
  const { updateBusiness } = useSession();
  const { setData } = useOnboarding();

  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePlanSelect = (plan: Plan) => setSelectedPlan(plan);

  const handleContinue = async () => {
    if (!selectedPlan) return;

    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const tierNumber = parseInt(selectedPlan.tier.replace("level", ""), 10) as BusinessTier;

    // Keep session in sync
    updateBusiness({
      selectedPlan: {
        name: selectedPlan.name,
        tier: selectedPlan.tier,
        price: selectedPlan.price,
      },
      tier: tierNumber,
    });

    // Persist in onboarding context
    setData({
      selectedPlan: {
        name: selectedPlan.name,
        tier: selectedPlan.tier,
        price: selectedPlan.price,
      },
      tier: tierNumber,
    });

    setLoading(false);

    // IMPORTANT: relative routes so we stay inside /business/onboarding/*
    if (tierNumber >= 3) {
      router.push("/business/onboarding/kyc");           // /business/onboarding/kyc
    } else {
      router.push("/business/onboarding/live-capture");  // /business/onboarding/live-capture
    }
  };

  const handleBack = () => router.back();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
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
            Step 2: Choose Plan - Horizontal Card Layout
          </Text>
        </View>

        {/* Main Content */}
        <Surface style={[styles.formContainer, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <View style={styles.formHeader}>
            <View style={styles.menuIcon}>
              <View style={[styles.menuLine, { backgroundColor: theme.colors.primary }]} />
              <View style={[styles.menuLine, { backgroundColor: theme.colors.primary }]} />
              <View style={[styles.menuLine, { backgroundColor: theme.colors.primary }]} />
            </View>
            <Text variant="titleLarge" style={[styles.formTitle, { color: theme.colors.primary }]}>
              Choose Your Plan
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Plan Cards */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.plansContainer}
            style={styles.plansScroll}
          >
            {plans.map((plan) => (
              <Card
                key={plan.id}
                style={[
                  styles.planCard,
                  selectedPlan?.id === plan.id && styles.selectedCard,
                  plan.isPopular && styles.popularCard,
                ]}
                onPress={() => handlePlanSelect(plan)}
              >
                <Card.Content style={styles.cardContent}>
                  <Text variant="headlineSmall" style={[styles.planName, { color: theme.colors.primary }]}>
                    {plan.name}
                  </Text>
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
                    style={[styles.planButton, { backgroundColor: plan.buttonColor }]}
                    contentStyle={styles.buttonContent}
                    labelStyle={[
                      styles.buttonLabel,
                      { color: plan.buttonColor === "#FBC02D" ? theme.colors.primary : theme.colors.onPrimary },
                    ]}
                  >
                    {plan.buttonText}
                  </Button>

                  <View style={styles.featuresSection}>
                    <Text variant="titleMedium" style={[styles.featuresTitle, { color: theme.colors.primary }]}>
                      {plan.name === "Eta"
                        ? "Core features:"
                        : `Everything in ${plan.name === "Zeta" ? "Eta" : "Zeta"}, plus:`}
                    </Text>

                    {plan.features.map((feature, index) => (
                      <View key={index} style={styles.featureRow}>
                        <Text style={styles.featureIcon}>{feature.icon}</Text>
                        <Text
                          variant="bodyMedium"
                          style={[styles.featureText, { color: theme.colors.onSurfaceVariant }]}
                        >
                          {feature.text}
                        </Text>
                      </View>
                    ))}
                  </View>
                </Card.Content>
              </Card>
            ))}
          </ScrollView>

          {/* Scroll Indicator */}
          <View style={styles.scrollIndicator}>
            <Text variant="bodyMedium" style={[styles.scrollText, { color: theme.colors.primary }]}>
              → Scroll to see Gamma, Beta & Alpha plans →
            </Text>
          </View>

          {/* Continue Button */}
          <Button
            mode="contained"
            onPress={handleContinue}
            loading={loading}
            disabled={loading || !selectedPlan}
            style={[styles.continueButton, { backgroundColor: selectedPlan ? "#FBC02D" : theme.colors.surfaceDisabled }]}
            contentStyle={styles.buttonContent}
            labelStyle={[styles.buttonLabel, { color: theme.colors.primary }]}
          >
            Continue with Selected Plan
          </Button>
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 20 },
  header: { alignItems: "center", marginBottom: 20 },
  backButton: { position: "absolute", left: -10, top: 30 },
  stepIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  stepNumber: { fontSize: 18, fontWeight: "bold" },
  title: { fontWeight: "bold", textAlign: "center" },
  formContainer: { borderRadius: 20, padding: 24, marginBottom: 20 },
  formHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  menuIcon: { marginRight: 12 },
  menuLine: { width: 20, height: 3, marginBottom: 3, borderRadius: 1.5 },
  formTitle: { fontWeight: "bold" },
  divider: { height: 2, backgroundColor: "#1559C1", marginBottom: 24 },
  plansContainer: { paddingHorizontal: 8 },
  plansScroll: { marginBottom: 20 },
  planCard: { width: width * 0.7, marginHorizontal: 8, backgroundColor: "#FFFFFF" },
  selectedCard: { borderColor: "#1559C1", borderWidth: 2 },
  popularCard: { borderColor: "#FBC02D", borderWidth: 2 },
  cardContent: { padding: 20 },
  planName: { fontWeight: "bold", marginBottom: 8 },
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
  continueButton: { borderRadius: 25, marginTop: 16 },
});
