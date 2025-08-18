"use client";

import { View, ScrollView, StyleSheet } from "react-native";
import { Text, Button, Surface, useTheme, Card } from "react-native-paper";
import { useRouter, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PendingVerification() {
  const router = useRouter();
  const theme = useTheme();

  const goToOnboarding = () => router.push("/business/onboarding" as Href);
  const goToSupport = () => router.push("/settings/support" as Href); // ← change if your path differs

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.stepIndicator, { backgroundColor: theme.colors.primary }]}>
            <Text style={[styles.stepNumber, { color: theme.colors.onPrimary }]}>7</Text>
          </View>
          <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onBackground }]}>
            Step 7: Pending Verification Dashboard
          </Text>
        </View>

        {/* Phone Status Bar Mockup */}
        <View style={[styles.phoneBar, { backgroundColor: theme.colors.primary }]}>
          <Text style={[styles.timeText, { color: theme.colors.onPrimary }]}>9:41 AM</Text>
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
              Dashboard
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Pending Banner */}
          <Card style={[styles.pendingBanner, { backgroundColor: "#FBC02D" }]}>
            <Card.Content style={styles.bannerContent}>
              <Text style={styles.warningIcon}>⚠️</Text>
              <View style={styles.bannerText}>
                <Text variant="bodyMedium" style={[styles.bannerTitle, { color: theme.colors.primary }]}>
                  Your business is pending verification by Slotly Admins.
                </Text>
                <Text variant="bodySmall" style={[styles.bannerSubtitle, { color: theme.colors.primary }]}>
                  Verification usually takes 1–2 days.
                </Text>
              </View>
            </Card.Content>
          </Card>

          {/* Dashboard Buttons (disabled while pending) */}
          <View style={styles.dashboardButtons}>
            <View style={styles.buttonRow}>
              <Button mode="outlined" style={[styles.dashboardButton, { borderColor: theme.colors.outline }]} contentStyle={styles.buttonContent} labelStyle={[styles.dashboardButtonLabel, { color: theme.colors.primary }]} disabled>
                Bookings
              </Button>
              <Button mode="outlined" style={[styles.dashboardButton, { borderColor: theme.colors.outline }]} contentStyle={styles.buttonContent} labelStyle={[styles.dashboardButtonLabel, { color: theme.colors.primary }]} disabled>
                Payments
              </Button>
            </View>
            <View style={styles.buttonRow}>
              <Button mode="outlined" style={[styles.dashboardButton, { borderColor: theme.colors.outline }]} contentStyle={styles.buttonContent} labelStyle={[styles.dashboardButtonLabel, { color: theme.colors.primary }]} disabled>
                Analytics
              </Button>
              <Button mode="outlined" style={[styles.dashboardButton, { borderColor: theme.colors.outline }]} contentStyle={styles.buttonContent} labelStyle={[styles.dashboardButtonLabel, { color: theme.colors.primary }]} disabled>
                Staff
              </Button>
            </View>
          </View>

          {/* Available actions */}
          <View style={styles.availableActions}>
            <Text variant="titleMedium" style={[styles.actionsTitle, { color: theme.colors.primary }]}>
              You can still:
            </Text>

            <Button mode="text" onPress={goToOnboarding} style={styles.actionButton} labelStyle={[styles.actionButtonLabel, { color: theme.colors.primary }]}>
              • Edit business profile
            </Button>

            <Button mode="text" onPress={() => console.log("View verification status")} style={styles.actionButton} labelStyle={[styles.actionButtonLabel, { color: theme.colors.primary }]}>
              • View verification status
            </Button>

            <Button mode="text" onPress={goToSupport} style={styles.actionButton} labelStyle={[styles.actionButtonLabel, { color: theme.colors.primary }]}>
              • Contact support
            </Button>
          </View>
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
  menuIcon: { marginRight: 12 },
  menuLine: { width: 20, height: 3, marginBottom: 3, borderRadius: 1.5 },
  formTitle: { fontWeight: "bold" },
  divider: { height: 2, backgroundColor: "#1559C1", marginBottom: 24 },
  pendingBanner: { marginBottom: 24 },
  bannerContent: { flexDirection: "row", alignItems: "center", padding: 16 },
  warningIcon: { fontSize: 24, marginRight: 12 },
  bannerText: { flex: 1 },
  bannerTitle: { fontWeight: "600", marginBottom: 4 },
  bannerSubtitle: { fontWeight: "400" },
  dashboardButtons: { marginBottom: 24 },
  buttonRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  dashboardButton: { flex: 1, opacity: 0.5 },
  buttonContent: { paddingVertical: 8 },
  dashboardButtonLabel: { fontSize: 14, fontWeight: "600" },
  availableActions: { alignItems: "center" },
  actionsTitle: { fontWeight: "bold", marginBottom: 16 },
  actionButton: { marginBottom: 4 },
  actionButtonLabel: { fontSize: 14, fontWeight: "600" },
});
