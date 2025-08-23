"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl } from "react-native";
import {
  Text,
  Surface,
  Button,
  IconButton,
  useTheme,
  Card,
  Divider,
  ActivityIndicator,
  Chip,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { useOnboarding } from "../../../context/OnboardingContext";
import { useSession } from "../../../context/SessionContext";

export default function PendingVerification() {
  const theme = useTheme();
  const router = useRouter();
  const { data } = useOnboarding();
  const { user, token, setUser } = useSession();

  const [refreshing, setRefreshing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<string>(
    user?.business?.verificationStatus || "pending"
  );

  const planName = data.selectedPlan?.name || "Level 1";
  const planTier = data.selectedPlan?.tier?.toUpperCase?.() || "LEVEL1";
  const hasPromo = !!data.promoApplied && !!data.trialEndsOn;

  const canEnterDashboard = useMemo(() => {
    const s = status?.toLowerCase?.() || "pending";
    return s === "approved" || s === "active" || s === "verified";
  }, [status]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const { getMe } = await import("../../../lib/api/modules/users");
      const me = await getMe(token || undefined);
      if (me) {
        setUser(me as any);
        setStatus(me?.business?.verificationStatus || "pending");
      }

      if (me?.business?.verificationStatus &&
          ["approved", "active", "verified"].includes(me.business.verificationStatus.toLowerCase())) {
        router.replace("/business/dashboard");
      }
    } catch (e) {
      // silently ignore refresh errors
    } finally {
      setRefreshing(false);
    }
  }, [router, setUser, token]);

  // Background poll every 15s while on this screen
  useEffect(() => {
    setChecking(true);
    refresh().finally(() => setChecking(false));
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [refresh]);

  const goToOnboarding = () => router.push("/business/onboarding" as Href);
  const goToSupport = () => router.push("/settings/support" as Href);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <IconButton
            icon="arrow-left"
            size={22}
            iconColor={theme.colors.primary}
            onPress={() => router.back()}
          />
          <View style={styles.titleContainer}>
            <View style={[styles.stepIndicator, { backgroundColor: theme.colors.primary }]}>
              <Text style={[styles.stepNumber, { color: theme.colors.onPrimary }]}>7</Text>
            </View>
            <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onBackground }]}>
              Step 7: Pending Verification
            </Text>
          </View>
        </View>

        {/* Status Hero */}
        <Surface style={[styles.hero, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <Text variant="titleLarge" style={styles.heroTitle}>
            Thanks! Your application was submitted.
          </Text>
          <Text variant="bodyMedium" style={styles.heroText}>
            Our team is reviewing your documents. You'll get an update soon.
          </Text>

          <View style={styles.statusRow}>
            <Chip
              icon={canEnterDashboard ? "check-circle" : "clock"}
              selectedColor={canEnterDashboard ? "#1B5E20" : theme.colors.primary}
              compact
            >
              {canEnterDashboard ? "Approved" : (status || "Pending").toString()}
            </Chip>
            {checking ? <ActivityIndicator style={{ marginLeft: 8 }} /> : null}
          </View>
        </Surface>

        {/* Pending Warning Banner */}
        {!canEnterDashboard && (
          <Card style={[styles.pendingBanner, { backgroundColor: "#FFF3C4" }]}>
            <Card.Content style={styles.bannerContent}>
              <Text style={styles.warningIcon}>⚠️</Text>
              <View style={styles.bannerText}>
                <Text variant="bodyMedium" style={[styles.bannerTitle, { color: theme.colors.primary }]}>
                  Your business is pending verification by Slotly Admins.
                </Text>
                <Text variant="bodySmall" style={[styles.bannerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  Verification usually takes 1–2 days.
                </Text>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Dashboard Preview (disabled while pending) */}
        {!canEnterDashboard && (
          <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <View style={styles.cardHeader}>
              <View style={styles.dashboardHeader}>
                <View style={styles.menuIcon}>
                  <View style={[styles.menuLine, { backgroundColor: theme.colors.primary }]} />
                  <View style={[styles.menuLine, { backgroundColor: theme.colors.primary }]} />
                  <View style={[styles.menuLine, { backgroundColor: theme.colors.primary }]} />
                </View>
                <Text variant="titleLarge" style={[styles.cardTitle, { color: theme.colors.primary }]}>
                  Dashboard Preview
                </Text>
              </View>
            </View>
            <Divider />
            
            <View style={styles.dashboardButtons}>
              <View style={styles.buttonRow}>
                <Button 
                  mode="outlined" 
                  style={[styles.dashboardButton, { borderColor: theme.colors.outline }]} 
                  contentStyle={styles.buttonContent} 
                  labelStyle={[styles.dashboardButtonLabel, { color: theme.colors.primary }]} 
                  disabled
                >
                  Bookings
                </Button>
                <Button 
                  mode="outlined" 
                  style={[styles.dashboardButton, { borderColor: theme.colors.outline }]} 
                  contentStyle={styles.buttonContent} 
                  labelStyle={[styles.dashboardButtonLabel, { color: theme.colors.primary }]} 
                  disabled
                >
                  Payments
                </Button>
              </View>
              <View style={styles.buttonRow}>
                <Button 
                  mode="outlined" 
                  style={[styles.dashboardButton, { borderColor: theme.colors.outline }]} 
                  contentStyle={styles.buttonContent} 
                  labelStyle={[styles.dashboardButtonLabel, { color: theme.colors.primary }]} 
                  disabled
                >
                  Analytics
                </Button>
                <Button 
                  mode="outlined" 
                  style={[styles.dashboardButton, { borderColor: theme.colors.outline }]} 
                  contentStyle={styles.buttonContent} 
                  labelStyle={[styles.dashboardButtonLabel, { color: theme.colors.primary }]} 
                  disabled
                >
                  Staff
                </Button>
              </View>
            </View>
          </Surface>
        )}

        {/* Submission Summary */}
        <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <View style={styles.cardHeader}>
            <Text variant="titleLarge" style={styles.cardTitle}>Submission Summary</Text>
            <Button mode="text" onPress={refresh}>Refresh</Button>
          </View>
          <Divider />
          <View style={styles.row}>
            <Text>Business</Text>
            <Text style={styles.value}>{data.businessName || "-"}</Text>
          </View>
          <View style={styles.row}>
            <Text>Plan</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Chip icon="star" compact>{planName}</Chip>
              <Chip compact>{planTier}</Chip>
            </View>
          </View>
          <View style={styles.row}>
            <Text>Verification</Text>
            <Text style={styles.value}>{data.businessVerificationType || "INFORMAL"}</Text>
          </View>
          <View style={styles.row}>
            <Text>Trial</Text>
            <Text
              style={[
                styles.value,
                { color: hasPromo ? "#1B5E20" : theme.colors.onSurfaceVariant },
              ]}
            >
              {hasPromo
                ? `Free until ${new Date(data.trialEndsOn!).toDateString()}`
                : "No trial applied"}
            </Text>
          </View>
        </Surface>

        {/* What happens next */}
        <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <Text variant="titleLarge" style={styles.cardTitle}>What happens next?</Text>
          <Divider style={{ marginVertical: 6 }} />
          <View style={styles.stepItem}>
            <Chip icon="file-check" compact>Document review</Chip>
            <Text style={styles.stepText}>
              We verify your details. If we need anything, we'll contact the email/phone you provided.
            </Text>
          </View>
          <View style={styles.stepItem}>
            <Chip icon="credit-card-check" compact>Subscription</Chip>
            <Text style={styles.stepText}>
              Your plan is set to <Text style={styles.bold}>{planName}</Text>. {hasPromo ? "The trial is already active." : "Billing starts when your account is approved."}
            </Text>
          </View>
          <View style={styles.stepItem}>
            <Chip icon="view-dashboard" compact>Go live</Chip>
            <Text style={styles.stepText}>
              Once approved, your business dashboard unlocks automatically.
            </Text>
          </View>
        </Surface>

        {/* Available Actions */}
        <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <Text variant="titleLarge" style={styles.cardTitle}>You can still:</Text>
          <Divider style={{ marginVertical: 6 }} />
          
          <Button 
            mode="text" 
            onPress={goToOnboarding} 
            style={styles.actionButton} 
            icon="pencil"
            contentStyle={styles.actionButtonContent}
          >
            Edit business profile
          </Button>

          <Button 
            mode="text" 
            onPress={refresh} 
            style={styles.actionButton} 
            icon="eye"
            contentStyle={styles.actionButtonContent}
          >
            View verification status
          </Button>

          <Button 
            mode="text" 
            onPress={goToSupport} 
            style={styles.actionButton} 
            icon="help-circle"
            contentStyle={styles.actionButtonContent}
          >
            Contact support
          </Button>
        </Surface>

        {/* Main Actions */}
        <View style={styles.actions}>
          <Button
            mode="contained"
            onPress={refresh}
            style={[styles.primaryBtn, { backgroundColor: theme.colors.primary }]}
            icon="refresh"
          >
            Refresh status
          </Button>

          {canEnterDashboard ? (
            <Button
              mode="contained"
              onPress={() => router.replace("/business/dashboard")}
              style={[styles.primaryBtn, { backgroundColor: "#1B5E20" }]}
              icon="view-dashboard"
            >
              Open dashboard
            </Button>
          ) : (
            <Button
              mode="outlined"
              onPress={() => router.replace("/(tabs)")}
              style={styles.secondaryBtn}
              icon="home"
            >
              Back to home
            </Button>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, padding: 20, gap: 12 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  titleContainer: { flex: 1, alignItems: "center", marginRight: 32 },
  stepIndicator: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    justifyContent: "center", 
    alignItems: "center", 
    marginBottom: 8 
  },
  stepNumber: { fontSize: 16, fontWeight: "bold" },
  title: { fontWeight: "700", textAlign: "center" },
  hero: { borderRadius: 16, padding: 16, gap: 8 },
  heroTitle: { fontWeight: "700", textAlign: "center" },
  heroText: { textAlign: "center" },
  statusRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "center", 
    marginTop: 6 
  },
  pendingBanner: { marginBottom: 12 },
  bannerContent: { flexDirection: "row", alignItems: "center", padding: 12 },
  warningIcon: { fontSize: 20, marginRight: 12 },
  bannerText: { flex: 1 },
  bannerTitle: { fontWeight: "600", marginBottom: 2 },
  bannerSubtitle: { fontWeight: "400" },
  card: { borderRadius: 16, padding: 16, gap: 8 },
  cardHeader: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between" 
  },
  dashboardHeader: { flexDirection: "row", alignItems: "center" },
  menuIcon: { marginRight: 12 },
  menuLine: { width: 18, height: 2, marginBottom: 3, borderRadius: 1 },
  cardTitle: { fontWeight: "700" },
  row: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    paddingVertical: 6 
  },
  value: { fontWeight: "600" },
  stepItem: { gap: 6, marginTop: 4 },
  stepText: { lineHeight: 20 },
  bold: { fontWeight: "700" },
  dashboardButtons: { marginTop: 8 },
  buttonRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  dashboardButton: { flex: 1, opacity: 0.5 },
  buttonContent: { paddingVertical: 8 },
  dashboardButtonLabel: { fontSize: 14, fontWeight: "600" },
  actionButton: { justifyContent: "flex-start", marginVertical: 2 },
  actionButtonContent: { justifyContent: "flex-start" },
  actions: { gap: 10, marginTop: 4 },
  primaryBtn: { borderRadius: 24 },
  secondaryBtn: { borderRadius: 24 },
});