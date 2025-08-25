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
import { useRouter, type Href, useFocusEffect } from "expo-router";
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
  const [isMounted, setIsMounted] = useState(false);
  const [navigationReady, setNavigationReady] = useState(false);

  const planName = data.selectedPlan?.name || "Level 1";
  const planTier = data.selectedPlan?.tier?.toUpperCase?.() || "LEVEL1";
  const hasPromo = !!data.promoApplied && !!data.trialEndsOn;

  const canEnterDashboard = useMemo(() => {
    const s = status?.toLowerCase?.() || "pending";
    return s === "approved" || s === "active" || s === "verified";
  }, [status]);

  // Enhanced safe navigation helper with better timing checks
  const safeNavigate = useCallback((path: string) => {
    if (isMounted && navigationReady) {
      try {
        // Use setTimeout to ensure navigation happens in next tick
        setTimeout(() => {
          router.replace(path as any);
        }, 100);
      } catch (error) {
        console.error("Navigation error:", error);
      }
    }
  }, [router, isMounted, navigationReady]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const { getMe } = await import("../../../lib/api/modules/users");
      const me = await getMe(token || undefined);
      if (me) {
        setUser(me as any);
        const newStatus = me?.business?.verificationStatus || "pending";
        setStatus(newStatus);

        // Auto-redirect when approved - enhanced logic with better safety checks
        const verificationStatus = newStatus?.toLowerCase();
        if (verificationStatus && ["approved", "active", "verified"].includes(verificationStatus)) {
          // Only navigate if component is mounted and navigation is ready
          if (isMounted && navigationReady) {
            // Add a longer delay to ensure everything is ready
            setTimeout(() => {
              safeNavigate("/business/dashboard");
            }, 1500);
          }
        }
      }
    } catch (e) {
      console.error("Failed to refresh verification status:", e);
      // Optionally show a subtle error indicator
    } finally {
      setRefreshing(false);
    }
  }, [setUser, token, safeNavigate, isMounted, navigationReady]);

  // Use useFocusEffect to ensure component is ready for navigation
  useFocusEffect(
    useCallback(() => {
      setNavigationReady(true);
      return () => {
        setNavigationReady(false);
      };
    }, [])
  );

  // Enhanced mount detection and initial setup
  useEffect(() => {
    setIsMounted(true);
    
    // Add a small delay before starting to check status
    const mountTimer = setTimeout(() => {
      setChecking(true);
      refresh().finally(() => setChecking(false));
    }, 500);

    // Polling interval - reduced frequency to prevent too many requests
    const pollInterval = setInterval(() => {
      if (isMounted && navigationReady) {
        refresh();
      }
    }, 10000); // Increased to 10 seconds for better performance

    return () => {
      clearTimeout(mountTimer);
      clearInterval(pollInterval);
      setIsMounted(false);
      setNavigationReady(false);
    };
  }, [refresh, isMounted, navigationReady]);

  // Safe navigation functions with proper checks
  const goToOnboarding = () => {
    if (navigationReady) safeNavigate("/business/onboarding");
  };
  
  const goToSupport = () => {
    if (navigationReady) safeNavigate("/settings/support");
  };
  
  const goToHome = () => {
    if (navigationReady) safeNavigate("/(tabs)");
  };
  
  const goToDashboard = () => {
    if (navigationReady && canEnterDashboard) {
      safeNavigate("/business/dashboard");
    }
  };

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
            onPress={() => navigationReady && router.back()}
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

        {/* Success Banner for Approved Status */}
        {canEnterDashboard && (
          <Card style={[styles.pendingBanner, { backgroundColor: "#E8F5E8" }]}>
            <Card.Content style={styles.bannerContent}>
              <Text style={styles.successIcon}>✅</Text>
              <View style={styles.bannerText}>
                <Text variant="bodyMedium" style={[styles.bannerTitle, { color: "#1B5E20" }]}>
                  Congratulations! Your business has been approved.
                </Text>
                <Text variant="bodySmall" style={[styles.bannerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  You can now access your business dashboard.
                </Text>
              </View>
            </Card.Content>
          </Card>
        )}

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
            <Button mode="text" onPress={refresh} disabled={!navigationReady}>
              Refresh
            </Button>
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
            disabled={!navigationReady}
          >
            Edit business profile
          </Button>

          <Button 
            mode="text" 
            onPress={refresh} 
            style={styles.actionButton} 
            icon="eye"
            contentStyle={styles.actionButtonContent}
            disabled={!navigationReady}
          >
            View verification status
          </Button>

          <Button 
            mode="text" 
            onPress={goToSupport} 
            style={styles.actionButton} 
            icon="help-circle"
            contentStyle={styles.actionButtonContent}
            disabled={!navigationReady}
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
            disabled={!navigationReady}
          >
            Refresh status
          </Button>

          {canEnterDashboard ? (
            <Button
              mode="contained"
              onPress={goToDashboard}
              style={[styles.primaryBtn, { backgroundColor: "#1B5E20" }]}
              icon="view-dashboard"
              disabled={!navigationReady}
            >
              Open dashboard
            </Button>
          ) : (
            <Button
              mode="outlined"
              onPress={goToHome}
              style={styles.secondaryBtn}
              icon="home"
              disabled={!navigationReady}
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
  successIcon: { fontSize: 20, marginRight: 12 },
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