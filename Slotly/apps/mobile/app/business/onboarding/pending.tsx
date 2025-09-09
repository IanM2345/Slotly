"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, Linking } from "react-native";
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
import { useRouter, useFocusEffect, type Href } from "expo-router";
import { useOnboarding } from "../../../context/OnboardingContext";
import { useSession } from "../../../context/SessionContext";
import { getVerification, getMyBusiness, getMyLatestVerification } from "../../../lib/api/modules/business";
import { getMe } from "../../../lib/api/modules/users";

type VerificationRecord = {
  id?: string;
  status?: string;
  idPhotoUrl?: string | null;
  selfieWithIdUrl?: string | null;
  licenseUrl?: string | null;
};

const ACTIVE_STATES = ["approved", "active", "verified"];
const PENDING_STATES = ["pending", "submitted", "under_review", "review"];

export default function PendingVerification() {
  const theme = useTheme();
  const router = useRouter();
  const { data } = useOnboarding();
  const { token, ready } = useSession();

  const [refreshing, setRefreshing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<string>("pending");
  const [bizId, setBizId] = useState<string | null>(null);
  const [verification, setVerification] = useState<VerificationRecord | null>(null);
  const [navigationReady, setNavigationReady] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const planName = data.selectedPlan?.name || "Level 1";
  const planTier = data.selectedPlan?.tier?.toUpperCase?.() || "LEVEL1";
  const hasPromo = !!data.promoApplied && !!data.trialEndsOn;

  const canEnterDashboard = useMemo(() => ACTIVE_STATES.includes(status), [status]);

  const safeNavigate = useCallback((path: Href) => {
    if (!navigationReady) return;
    try {
      setTimeout(() => router.replace(path), 100);
    } catch (e) {
      console.error("Navigation error:", e);
    }
  }, [router, navigationReady]);

  const openUrl = (url?: string | null) => {
    if (!url) return;
    Linking.openURL(url).catch(() => {});
  };

  const readVerificationStrict = useCallback(async (bId: string) => {
    // Primary: /api/businesses/[id]/verification
    try {
      const res: any = await getVerification(token!, bId);
      const ver: VerificationRecord | null = res?.verification ?? (res ?? null);
      return ver;
    } catch (err: any) {
      // Fallback: /api/businesses/verification/latest
      try {
        const latest: any = await getMyLatestVerification(token!);
        return (latest?.verification ?? latest) as VerificationRecord | null;
      } catch {
        return null;
      }
    }
  }, [token]);

  const resolveBizIdOnce = useCallback(async () => {
    // Try fast path via /api/users/me
    const me = await getMe(token!);
    let id: string | null = me?.business?.id ?? null;

    // Fallback: normalized getMyBusiness()
    if (!id) {
      const myBiz = await getMyBusiness(token!); // returns { business: me.business }
      id = myBiz?.business?.id ?? null;
    }
    return id;
  }, [token]);

  const refresh = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      // Ensure we have a business id
      let id = bizId;
      if (!id) id = await resolveBizIdOnce();
      if (id) setBizId(id);

      // Read the freshest verification record (prefer server record)
      let nextStatus = status;
      let ver: VerificationRecord | null = verification;

      if (id) {
        const strict = await readVerificationStrict(id);
        if (strict) {
          ver = strict;
          if (strict.status) nextStatus = String(strict.status).toLowerCase();
        }
      }

      // If server didn’t return anything (older backends), peek at /api/users/me
      if (!ver) {
        const me = await getMe(token);
        const s = me?.business?.verificationStatus;
        if (s) nextStatus = String(s).toLowerCase();
      }

      setVerification(ver ?? null);
      setStatus(nextStatus);

      // Navigate as soon as we’re active
      if (ACTIVE_STATES.includes(nextStatus)) {
        // stop polling
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        safeNavigate("/business/dashboard");
      }
    } catch (e) {
      console.error("Failed to refresh verification status:", e);
    } finally {
      setRefreshing(false);
    }
  }, [token, bizId, status, verification, resolveBizIdOnce, readVerificationStrict, safeNavigate]);

  // Prepare navigation readiness
  useFocusEffect(
    useCallback(() => {
      setNavigationReady(true);
      return () => setNavigationReady(false);
    }, [])
  );

  // Initial load
  useEffect(() => {
    if (!ready) return;
    setChecking(true);
    refresh().finally(() => setChecking(false));
  }, [ready, refresh]);

  // Poll while in a pending state; stop when active
useEffect(() => {
  if (!ready) return;

  // Start polling while status is pending
  if (PENDING_STATES.includes(status)) {
    if (pollRef.current == null) {
      pollRef.current = setInterval(() => {
        refresh();
      }, 10_000);
    }
  } else {
    // Stop polling if we’re no longer pending
    if (pollRef.current != null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  // Cleanup on unmount/dep change
  return () => {
    if (pollRef.current != null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };
}, [ready, status, refresh]);


  const goToOnboarding = () => navigationReady && safeNavigate("/business/onboarding");
  const goToSupport = () => navigationReady && safeNavigate("/settings/support");
  const goToHome = () => navigationReady && safeNavigate("/(tabs)");
  const goToDashboard = () => navigationReady && canEnterDashboard && safeNavigate("/business/dashboard");

  const trialText = useMemo(() => {
    if (hasPromo && data.trialEndsOn) {
      return `Free until ${new Date(data.trialEndsOn).toDateString()}`;
    }
    return "No trial applied";
  }, [hasPromo, data.trialEndsOn]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
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

        {/* Success */}
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

        {/* Pending */}
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
            <Text style={[styles.value, { color: hasPromo ? "#1B5E20" : theme.colors.onSurfaceVariant }]}>
              {trialText}
            </Text>
          </View>
        </Surface>

        {/* Documents */}
        {verification && (
          <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <Text variant="titleLarge" style={styles.cardTitle}>Submitted documents</Text>
            <Divider style={{ marginVertical: 6 }} />
            <View style={styles.row}>
              <Text>ID photo</Text>
              {verification.idPhotoUrl
                ? <Button mode="text" onPress={() => openUrl(verification.idPhotoUrl)}>View</Button>
                : <Text style={styles.value}>—</Text>}
            </View>
            <View style={styles.row}>
              <Text>Selfie with ID</Text>
              {verification.selfieWithIdUrl
                ? <Button mode="text" onPress={() => openUrl(verification.selfieWithIdUrl)}>View</Button>
                : <Text style={styles.value}>—</Text>}
            </View>
            <View style={styles.row}>
              <Text>License/Permit</Text>
              {verification.licenseUrl
                ? <Button mode="text" onPress={() => openUrl(verification.licenseUrl)}>View</Button>
                : <Text style={styles.value}>—</Text>}
            </View>
          </Surface>
        )}

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

        {/* Actions */}
        <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <Text variant="titleLarge" style={styles.cardTitle}>You can still:</Text>
          <Divider style={{ marginVertical: 6 }} />
          <Button mode="text" onPress={goToOnboarding} style={styles.actionButton} icon="pencil" contentStyle={styles.actionButtonContent} disabled={!navigationReady}>
            Edit business profile
          </Button>
          <Button mode="text" onPress={refresh} style={styles.actionButton} icon="eye" contentStyle={styles.actionButtonContent} disabled={!navigationReady}>
            View verification status
          </Button>
          <Button mode="text" onPress={goToSupport} style={styles.actionButton} icon="help-circle" contentStyle={styles.actionButtonContent} disabled={!navigationReady}>
            Contact support
          </Button>
        </Surface>

        <View style={styles.actions}>
          <Button mode="contained" onPress={refresh} style={[styles.primaryBtn, { backgroundColor: theme.colors.primary }]} icon="refresh" disabled={!navigationReady}>
            Refresh status
          </Button>
          {canEnterDashboard ? (
            <Button mode="contained" onPress={goToDashboard} style={[styles.primaryBtn, { backgroundColor: "#1B5E20" }]} icon="view-dashboard" disabled={!navigationReady}>
              Open dashboard
            </Button>
          ) : (
            <Button mode="outlined" onPress={goToHome} style={styles.secondaryBtn} icon="home" disabled={!navigationReady}>
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
  stepIndicator: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  stepNumber: { fontSize: 16, fontWeight: "bold" },
  title: { fontWeight: "700", textAlign: "center" },
  hero: { borderRadius: 16, padding: 16, gap: 8 },
  heroTitle: { fontWeight: "700", textAlign: "center" },
  heroText: { textAlign: "center" },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 6 },
  pendingBanner: { marginBottom: 12 },
  bannerContent: { flexDirection: "row", alignItems: "center", padding: 12 },
  warningIcon: { fontSize: 20, marginRight: 12 },
  successIcon: { fontSize: 20, marginRight: 12 },
  bannerText: { flex: 1 },
  bannerTitle: { fontWeight: "600", marginBottom: 2 },
  bannerSubtitle: { fontWeight: "400" },
  card: { borderRadius: 16, padding: 16, gap: 8 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dashboardHeader: { flexDirection: "row", alignItems: "center" },
  menuIcon: { marginRight: 12 },
  menuLine: { width: 18, height: 2, marginBottom: 3, borderRadius: 1 },
  cardTitle: { fontWeight: "700" },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  value: { fontWeight: "600" },
  stepItem: { gap: 6, marginTop: 4 },
  stepText: { lineHeight: 20 },
  bold: { fontWeight: "700" },
  actionButton: { justifyContent: "flex-start", marginVertical: 2 },
  actionButtonContent: { justifyContent: "flex-start" },
  actions: { gap: 10, marginTop: 4 },
  primaryBtn: { borderRadius: 24 },
  secondaryBtn: { borderRadius: 24 },
});
