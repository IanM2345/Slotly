"use client";

import { useState } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { Text, Button, Surface, useTheme, IconButton, Card, Checkbox } from "react-native-paper";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ReviewSubmit() {
  const router = useRouter();
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const handleSubmit = async () => {
    if (!agreedToTerms) return;
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setLoading(false);
    router.push("/business/onboarding/pending");
  };

  const handleBack = () => router.back();

  const handleTermsPress = () => {
    // open terms modal / link later
    console.log("Open Terms & Privacy Policy");
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.stepIndicator, { backgroundColor: theme.colors.primary }]}>
            <Text style={[styles.stepNumber, { color: theme.colors.onPrimary }]}>6</Text>
          </View>
          <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onBackground }]}>
            Step 6: Review & Submit
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
              Review Application
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Review Summary */}
          <Card style={styles.summaryCard}>
            <Card.Content style={styles.summaryContent}>
              <View style={styles.summaryRow}>
                <Text variant="bodyMedium" style={[styles.summaryLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Business:
                </Text>
                <Text variant="bodyMedium" style={[styles.summaryValue, { color: theme.colors.onSurface }]}>
                  Nairobi Hair Studio
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text variant="bodyMedium" style={[styles.summaryLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Type:
                </Text>
                <Text variant="bodyMedium" style={[styles.summaryValue, { color: theme.colors.onSurface }]}>
                  Salon
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text variant="bodyMedium" style={[styles.summaryLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Plan:
                </Text>
                <Text variant="bodyMedium" style={[styles.summaryValue, { color: theme.colors.onSurface }]}>
                  Zeta (ksh 499-1499)
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text variant="bodyMedium" style={[styles.summaryLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Payment:
                </Text>
                <Text variant="bodyMedium" style={[styles.summaryValue, { color: theme.colors.onSurface }]}>
                  M-Pesa Till
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text variant="bodyMedium" style={[styles.summaryLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Documents:
                </Text>
                <Text variant="bodyMedium" style={[styles.summaryValue, { color: "#2E7D32" }]}>
                  ✅ Complete
                </Text>
              </View>
            </Card.Content>
          </Card>

          {/* Terms Agreement */}
          <View style={styles.termsContainer}>
            <View style={styles.termsRow}>
              <Checkbox
                status={agreedToTerms ? "checked" : "unchecked"}
                onPress={() => setAgreedToTerms(!agreedToTerms)}
                color={theme.colors.primary}
              />
              <Text variant="bodyMedium" style={[styles.termsText, { color: theme.colors.primary }]} onPress={handleTermsPress}>
                By submitting, you agree to Slotly Terms & Privacy Policy
              </Text>
            </View>
          </View>

          {/* Submit Button */}
          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading || !agreedToTerms}
            style={[styles.submitButton, { backgroundColor: agreedToTerms ? "#FBC02D" : theme.colors.surfaceDisabled }]}
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
  summaryCard: { backgroundColor: "#FFFFFF", marginBottom: 24, borderWidth: 1, borderColor: "#E5E7EB" },
  summaryContent: { padding: 20 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  summaryLabel: { fontWeight: "600" },
  summaryValue: { fontWeight: "400" },
  termsContainer: { marginBottom: 24 },
  termsRow: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 8 },
  termsText: { flex: 1, marginLeft: 8, lineHeight: 20, fontWeight: "600", textDecorationLine: "underline" },
  submitButton: { borderRadius: 25 },
  buttonContent: { paddingVertical: 8 },
  buttonLabel: { fontSize: 16, fontWeight: "600" },
});
