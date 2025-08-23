"use client";

import { useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Text, Surface, useTheme, IconButton, Button, Card } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useOnboarding } from "../../../context/OnboardingContext";

type SectionId = "kra" | "owner" | "industry" | "payment" | "admin";

interface KYCSection {
  id: SectionId;
  title: string;
  subtitle: string;
  completed: boolean;
}

const SECTION_ROUTE: Record<SectionId, string> = {
  kra: "/business/onboarding/upload-docs",
  owner: "/business/onboarding/owner-details",
  industry: "/business/onboarding/industry",
  payment: "/business/onboarding/payment-setup",
  admin: "/business/onboarding/admin-users",
};

export default function KYCHub() {
  const theme = useTheme();
  const router = useRouter();
  const { data, goNext } = useOnboarding();
  const [loading, setLoading] = useState(false);

  const sections: KYCSection[] = [
    { 
      id: "kra", 
      title: "Upload KRA / Registration Docs", 
      subtitle: "KRA PIN, Reg. cert, license", 
      completed: !!data.kycSections?.kra 
    },
    { 
      id: "owner", 
      title: "Owner / CEO Details", 
      subtitle: "Name, phone, ID number", 
      completed: !!data.kycSections?.owner 
    },
    { 
      id: "industry", 
      title: "Industry", 
      subtitle: "Category & brief description", 
      completed: !!data.kycSections?.industry 
    },
    { 
      id: "admin", 
      title: "Admin Users", 
      subtitle: "Invite managers/staff", 
      completed: !!data.kycSections?.admin 
    },
  ];

  const handleSectionPress = (sectionId: SectionId) => {
    router.push(SECTION_ROUTE[sectionId] as any);
  };

  const handleContinue = async () => {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    setLoading(false);
    goNext("step3");
  };

  const handleBack = () => router.back();

  const allSectionsCompleted = sections.every((s) => s.completed);
  const completedCount = sections.filter((s) => s.completed).length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView 
        contentContainerStyle={styles.scroll} 
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Step Indicator */}
        <View style={styles.header}>
          <IconButton 
            icon="arrow-left" 
            size={22} 
            iconColor={theme.colors.primary}
            onPress={handleBack} 
          />
          <View style={styles.headerContent}>
            <View style={[styles.stepIndicator, { backgroundColor: theme.colors.primary }]}>
              <Text style={[styles.stepNumber, { color: theme.colors.onPrimary }]}>3</Text>
            </View>
            <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onBackground }]}>
              Step 3: KYC Verification
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBackground, { backgroundColor: theme.colors.outline }]}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  backgroundColor: theme.colors.primary,
                  width: `${(completedCount / sections.length) * 100}%`
                }
              ]} 
            />
          </View>
          <Text variant="bodySmall" style={[styles.progressText, { color: theme.colors.onSurfaceVariant }]}>
            {completedCount} of {sections.length} completed
          </Text>
        </View>

        {/* Main Card */}
        <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <Text variant="titleLarge" style={[styles.cardTitle, { color: theme.colors.primary }]}>
            Complete these items
          </Text>
          
          <Text variant="bodyMedium" style={[styles.cardSubtitle, { color: theme.colors.onSurfaceVariant }]}>
            Upload your documents and provide required information
          </Text>

          <View style={styles.sectionsContainer}>
            {sections.map((section, index) => (
              <Card
                key={section.id}
                mode={section.completed ? "elevated" : "outlined"}
                style={[
                  styles.item, 
                  section.completed && styles.completedItem,
                  index === sections.length - 1 && styles.lastItem
                ]}
                onPress={() => handleSectionPress(section.id)}
              >
                <Card.Content style={styles.row}>
                  <View style={styles.sectionContent}>
                    <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.primary }]}>
                      {section.title}
                    </Text>
                    <Text variant="bodySmall" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                      {section.subtitle}
                    </Text>
                  </View>
                  
                  <View style={styles.sectionRight}>
                    <Text
                      variant="labelSmall"
                      style={[
                        styles.badge,
                        {
                          backgroundColor: section.completed ? "#E8F5E9" : "#FFF3E0",
                          color: section.completed ? "#1B5E20" : "#E65100",
                        },
                      ]}
                    >
                      {section.completed ? "Done" : "Pending"}
                    </Text>
                    {section.completed && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                    <IconButton 
                      icon="chevron-right" 
                      size={20} 
                      iconColor={theme.colors.primary}
                      style={styles.chevron}
                    />
                  </View>
                </Card.Content>
              </Card>
            ))}
          </View>

          <Button
            mode="contained"
            onPress={handleContinue}
            loading={loading}
            disabled={loading || !allSectionsCompleted}
            style={[
              styles.nextBtn, 
              { 
                backgroundColor: allSectionsCompleted ? "#FBC02D" : theme.colors.surfaceDisabled,
                opacity: allSectionsCompleted ? 1 : 0.6
              }
            ]}
            contentStyle={styles.buttonContent}
            labelStyle={[styles.buttonLabel, { color: theme.colors.primary }]}
          >
            {allSectionsCompleted ? "Continue to Review" : `Complete ${sections.length - completedCount} more items`}
          </Button>

          <Text variant="bodySmall" style={[styles.helperText, { color: theme.colors.onSurfaceVariant }]}>
            All sections must be completed before proceeding to the next step
          </Text>
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  scroll: { 
    flexGrow: 1, 
    padding: 20, 
    gap: 16 
  },
  header: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginBottom: 8 
  },
  headerContent: {
    flex: 1,
    alignItems: "center",
    marginLeft: -40 // Offset for back button
  },
  stepIndicator: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    justifyContent: "center", 
    alignItems: "center", 
    marginBottom: 8 
  },
  stepNumber: { 
    fontSize: 18, 
    fontWeight: "bold" 
  },
  title: { 
    fontWeight: "700", 
    textAlign: "center" 
  },
  progressContainer: {
    alignItems: "center",
    marginBottom: 8
  },
  progressBackground: {
    width: "100%",
    height: 6,
    borderRadius: 3,
    marginBottom: 8
  },
  progressFill: {
    height: "100%",
    borderRadius: 3
  },
  progressText: {
    fontSize: 12
  },
  card: { 
    borderRadius: 16, 
    padding: 20
  },
  cardTitle: {
    fontWeight: "700", 
    marginBottom: 8,
    textAlign: "center"
  },
  cardSubtitle: {
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20
  },
  sectionsContainer: {
    marginBottom: 24
  },
  item: { 
    marginBottom: 12, 
    borderRadius: 12,
    backgroundColor: "#FFFFFF"
  },
  completedItem: {
    borderColor: "#4CAF50",
    backgroundColor: "#F8FFF8"
  },
  lastItem: {
    marginBottom: 0
  },
  row: { 
    flexDirection: "row", 
    alignItems: "center", 
    paddingVertical: 4
  },
  sectionContent: {
    flex: 1,
    paddingRight: 12
  },
  sectionTitle: {
    fontWeight: "600",
    marginBottom: 4,
    lineHeight: 20
  },
  sectionSubtitle: {
    lineHeight: 16
  },
  sectionRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  badge: { 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 12,
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase"
  },
  checkmark: {
    fontSize: 16,
    color: "#4CAF50",
    fontWeight: "bold"
  },
  chevron: {
    margin: 0
  },
  nextBtn: { 
    borderRadius: 28, 
    marginBottom: 16
  },
  buttonContent: {
    paddingVertical: 8
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: "700"
  },
  helperText: {
    textAlign: "center",
    lineHeight: 18,
    fontStyle: "italic"
  },
});