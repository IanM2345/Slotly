"use client";

import { useState } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { Text, Button, Surface, useTheme, IconButton, Card } from "react-native-paper";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

type SectionId = "kra" | "owner" | "industry" | "payment" | "admin";

interface KYCSection {
  id: SectionId;
  title: string;
  completed: boolean;
}

const SECTION_ROUTE: Record<SectionId, string> = {
  kra: "/business/onboarding/upload-docs",
  owner: "/business/onboarding/owner-details",
  industry: "/business/onboarding/industry",
  payment: "/business/onboarding/payment-setup",
  admin: "/business/onboarding/admin-users",
};

export default function KYCDocuments() {
  const router = useRouter();
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<KYCSection[]>([
    { id: "kra", title: "Upload KRA/Reg Docs", completed: false },
    { id: "owner", title: "Owner/CEO Details", completed: false },
    { id: "industry", title: "Industry", completed: false },
    { id: "payment", title: "Payment setup", completed: false },
    { id: "admin", title: "Admin Users", completed: false },
  ]);

  const handleSectionPress = (sectionId: SectionId) => {
    router.push(SECTION_ROUTE[sectionId] as any);
    // Optional optimistic completion
    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, completed: true } : s)));
  };

  const handleContinue = async () => {
    setLoading(true);
    await new Promise((res) => setTimeout(res, 300));
    setLoading(false);
    router.push("/business/onboarding/review");
  };

  const handleBack = () => router.back();

  const allSectionsCompleted = sections.every((s) => s.completed);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.stepIndicator, { backgroundColor: theme.colors.primary }]}>
            <Text style={[styles.stepNumber, { color: theme.colors.onPrimary }]}>3</Text>
          </View>
          <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onBackground }]}>
            Step 3: Verification Documents
          </Text>
        </View>

        {/* Phone Status Bar Mockup */}
        <View style={[styles.phoneBar, { backgroundColor: theme.colors.primary }]}>
          <Text style={[styles.timeText, { color: theme.colors.onPrimary }]}>9:41 AM</Text>
        </View>

        {/* Main Content */}
        <Surface style={[styles.formContainer, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <View style={styles.formHeader}>
            <IconButton
              icon="arrow-left"
              size={20}
              iconColor={theme.colors.primary}
              onPress={handleBack}
              style={styles.backIcon}
            />
            <View style={styles.menuIcon}>
              <View style={[styles.menuLine, { backgroundColor: theme.colors.primary }]} />
              <View style={[styles.menuLine, { backgroundColor: theme.colors.primary }]} />
              <View style={[styles.menuLine, { backgroundColor: theme.colors.primary }]} />
            </View>
            <Text variant="titleLarge" style={[styles.formTitle, { color: theme.colors.primary }]}>
              Upload Documents
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Document Sections */}
          <View style={styles.sectionsContainer}>
            {sections.map((section) => (
              <Card
                key={section.id}
                style={[styles.sectionCard, section.completed && styles.completedCard]}
                onPress={() => handleSectionPress(section.id)}
              >
                <Card.Content style={styles.sectionContent}>
                  <View style={styles.sectionRow}>
                    <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.primary }]}>
                      {section.title}
                    </Text>
                    <View style={styles.sectionRight}>
                      {section.completed && <Text style={styles.checkmark}>✓</Text>}
                      <Text style={[styles.arrow, { color: theme.colors.primary }]}>{">"}</Text>
                    </View>
                  </View>
                </Card.Content>
              </Card>
            ))}
          </View>

          {/* Continue Button */}
          <Button
            mode="contained"
            onPress={handleContinue}
            loading={loading}
            disabled={loading || !allSectionsCompleted}
            style={[styles.continueButton, { backgroundColor: allSectionsCompleted ? "#FBC02D" : theme.colors.surfaceDisabled }]}
            contentStyle={styles.buttonContent}
            labelStyle={[styles.buttonLabel, { color: theme.colors.primary }]}
          >
            Continue to Review
          </Button>

          <Text variant="bodySmall" style={[styles.helperText, { color: theme.colors.primary }]}>
            *For owner details include name, phone number and identification and official email
          </Text>
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 20 },
  header: { alignItems: "center", marginBottom: 20 },
  stepIndicator: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  stepNumber: { fontSize: 18, fontWeight: "bold" },
  title: { fontWeight: "bold", textAlign: "center" },
  phoneBar: { height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", marginBottom: 20 },
  timeText: { fontSize: 16, fontWeight: "600" },
  formContainer: { borderRadius: 20, padding: 24, marginBottom: 20 },
  formHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  backIcon: { marginLeft: -8, marginRight: 4 },
  menuIcon: { marginRight: 12 },
  menuLine: { width: 20, height: 3, marginBottom: 3, borderRadius: 1.5 },
  formTitle: { fontWeight: "bold" },
  divider: { height: 2, backgroundColor: "#1559C1", marginBottom: 24 },
  sectionsContainer: { marginBottom: 32 },
  sectionCard: { marginBottom: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB" },
  completedCard: { borderColor: "#2E7D32", backgroundColor: "#F1F8E9" },
  sectionContent: { paddingVertical: 16, paddingHorizontal: 20 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontWeight: "600", flex: 1 },
  sectionRight: { flexDirection: "row", alignItems: "center" },
  checkmark: { fontSize: 18, color: "#2E7D32", marginRight: 8, fontWeight: "bold" },
  arrow: { fontSize: 18, fontWeight: "bold" },
  continueButton: { borderRadius: 25, marginBottom: 16 },
  buttonContent: { paddingVertical: 8 },
  buttonLabel: { fontSize: 16, fontWeight: "600" },
  helperText: { textAlign: "center", fontStyle: "italic", lineHeight: 18 },
});
