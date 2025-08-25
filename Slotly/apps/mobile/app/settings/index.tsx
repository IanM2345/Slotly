// apps/mobile/app/settings/index.tsx
"use client";

import React, { useEffect, useState } from "react";
import * as Sentry from "sentry-expo"; // mobile Sentry
import { View, ScrollView, StyleSheet } from "react-native";
import {
  Text,
  Surface,
  List,
  Switch,
  IconButton,
  TouchableRipple,
  Button,
  useTheme,
} from "react-native-paper";
import { useRouter } from "expo-router";
import { useSession } from "../../context/SessionContext";
import { getNotificationsEnabled, setNotificationsEnabled } from "../../lib/settings/api";
import { meHeartbeat } from "../../lib/api/modules/auth";

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { token, user, setUser, signOut } = useSession(); // Added signOut from context
  const [notificationsEnabledState, setNotificationsEnabledState] = useState(true);
  const [verifyingRole, setVerifyingRole] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false); // Added loading state

  useEffect(() => {
    getNotificationsEnabled().then(setNotificationsEnabledState).catch(() => {});
  }, []);

  const ONBOARDING_START = "/business/onboarding" as const;

  const handleBack = () => router.back();
  const handleNavigation = (route: string) => {
    // Keep your existing loose navigation helper
    router.push(route as any);
  };

  // 🔐 Verify role from backend using current token -> merge into session
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!token) return;
      try {
        setVerifyingRole(true);
        const fresh = await meHeartbeat(); // server-authoritative user { id, role, ... }
        if (mounted && fresh) {
          // Keep any client-only fields, prefer server ones
          setUser({ ...(user ?? {}), ...fresh });
        }
      } catch (e) {
        // capture but don't block settings
        Sentry.Native.captureException(e);
      } finally {
        mounted && setVerifyingRole(false);
      }
    })();
    return () => { mounted = false; };
  }, [token]);

  // 🎯 Role-aware primary action
  const role = user?.role; // 'CUSTOMER' | 'STAFF' | 'BUSINESS_OWNER' | 'ADMIN' | ...
  const toTitle = (r?: string) => {
    switch (r) {
      case "CUSTOMER": return "Switch to Business Account";
      case "STAFF": return "Go to Staff Dashboard";
      case "BUSINESS_OWNER": return "Go to Business Dashboard";
      case "ADMIN": return "Open Admin Console";
      default: return "Verify Account";
    }
  };
  const goPrimary = () => {
    if (role === "CUSTOMER") return router.push("/business/onboarding" as any);
    if (role === "STAFF") return router.push("/business/dashboard/staff" as any);
    if (role === "BUSINESS_OWNER") return router.push("/business/dashboard" as any);
    if (role === "ADMIN") return router.push("/admin" as any);
    return router.push("/business/onboarding" as any);
  };

  // 🚪 Complete logout implementation
  const handleLogout = async () => {
    if (loggingOut) return; // Prevent double-clicks
    
    setLoggingOut(true);
    try {
      console.log("👋 Logging out...");
      
      // Call the centralized signOut from SessionContext
      // This will:
      // 1. Call the backend /api/auth/logout (revokes refresh tokens)
      // 2. Clear tokens from SecureStore 
      // 3. Clear in-memory session state
      // 4. Clear Sentry user context
      await signOut();
      
      console.log("✅ Logout completed successfully");
      
    } catch (error) {
      // signOut() already handles errors gracefully, so this shouldn't happen
      console.error("❌ Logout error:", error);
      
      // Capture for monitoring but don't block logout
      if (Sentry?.Native?.captureException) {
        Sentry.Native.captureException(error);
      }
    } finally {
      setLoggingOut(false);
      
      // Always navigate to login, regardless of logout success/failure
      // Replace the entire navigation stack so back button can't return
      router.replace("auth/login" as any);
    }
  };

  const handleSwitchToBusiness = () => {
    // Flip session locally (backend partner will persist)
    setUser({
      ...(user ?? { accountType: "consumer" }),
      accountType: "business",
      business: { ...(user?.business ?? {}), verificationStatus: "unverified" },
    });
    router.push(ONBOARDING_START as any);
  };

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.background }]}>
        <IconButton icon="arrow-left" size={24} iconColor={theme.colors.onBackground} onPress={handleBack} />
        <View style={styles.headerContent}>
          <IconButton icon="cog" size={28} iconColor={theme.colors.onBackground} style={styles.gearIcon} />
          <Text style={[styles.headerTitle, { color: theme.colors.onBackground }]}>Settings</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Business section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>Business</Text>
          <Surface
            style={{
              borderRadius: 16,
              padding: 16,
              backgroundColor: theme.colors.surface,
            }}
            elevation={1}
          >
            <View style={{ gap: 8 }}>
              <Text style={{ color: theme.colors.onSurfaceVariant }}>
                Run your services on Slotly with bookings, payments and analytics.
              </Text>

              {/* Small status line */}
              <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
                {verifyingRole ? "Verifying role…" : `Signed in as ${role ?? "unknown role"}`}
              </Text>

              <Button
                mode="contained"
                onPress={role === "CUSTOMER" ? handleSwitchToBusiness : goPrimary}
                disabled={verifyingRole}
                style={{ borderRadius: 28, marginTop: 4 }}
                contentStyle={{ paddingVertical: 8 }}
                labelStyle={{ fontWeight: "700", color: theme.colors.primary }}
                buttonColor={"#FBC02D"}
              >
                {toTitle(role)}
              </Button>
            </View>
          </Surface>
        </View>

        {/* Personal Information */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>Personal Information</Text>

          <TouchableRipple onPress={() => handleNavigation("/settings/account-details")} rippleColor="rgba(0,0,0,0.1)">
            <List.Item title="Account Details" titleStyle={[styles.listItemTitle, { color: theme.colors.onBackground }]} style={styles.listItem} />
          </TouchableRipple>

          <TouchableRipple onPress={() => handleNavigation("/settings/payment-details")} rippleColor="rgba(0,0,0,0.1)">
            <List.Item title="Payment Details" titleStyle={[styles.listItemTitle, { color: theme.colors.onBackground }]} style={styles.listItem} />
          </TouchableRipple>

          <TouchableRipple onPress={() => handleNavigation("/settings/family-and-friends")} rippleColor="rgba(0,0,0,0.1)">
            <List.Item title="Family and Friends" titleStyle={[styles.listItemTitle, { color: theme.colors.onBackground }]} style={styles.listItem} />
          </TouchableRipple>

          <TouchableRipple onPress={() => handleNavigation("/settings/address")} rippleColor="rgba(0,0,0,0.1)">
            <List.Item title="Address" titleStyle={[styles.listItemTitle, { color: theme.colors.onBackground }]} style={styles.listItem} />
          </TouchableRipple>
        </View>

        {/* Notification */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>Notification</Text>
          <View style={styles.notificationRow}>
            <Text style={{ color: theme.colors.onBackground, fontSize: 16 }}>Turn on notifications</Text>
            <Switch
              value={notificationsEnabledState}
              onValueChange={async (v) => {
                setNotificationsEnabledState(v);
                try { await setNotificationsEnabled(v); } catch {}
              }}
              color={theme.colors.primary}
            />
          </View>
        </View>

        {/* Language */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>Language</Text>

          <TouchableRipple onPress={() => handleNavigation("/settings/language")} rippleColor="rgba(0,0,0,0.1)">
            <View style={styles.languageItem}>
              <View>
                <Text style={[styles.languageLabel, { color: theme.colors.onBackground }]}>Language:</Text>
                <Text style={[styles.languageValue, { color: theme.colors.onBackground }]}>Automatic(English)</Text>
              </View>
              <IconButton icon="chevron-right" size={24} iconColor={theme.colors.onBackground} />
            </View>
          </TouchableRipple>

          <TouchableRipple onPress={() => handleNavigation("/settings/country")} rippleColor="rgba(0,0,0,0.1)">
            <View style={styles.languageItem}>
              <View>
                <Text style={[styles.languageLabel, { color: theme.colors.onBackground }]}>Country:</Text>
                <Text style={[styles.languageValue, { color: theme.colors.onBackground }]}>Kenya</Text>
              </View>
              <IconButton icon="chevron-right" size={24} iconColor={theme.colors.onBackground} />
            </View>
          </TouchableRipple>
        </View>

        {/* Others */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>Others</Text>

          <TouchableRipple onPress={() => handleNavigation("/settings/change-password")} rippleColor="rgba(0,0,0,0.1)">
            <View style={styles.othersItem}>
              <Text style={{ color: theme.colors.onBackground, fontSize: 16 }}>Change Password</Text>
              <IconButton icon="chevron-right" size={24} iconColor={theme.colors.onBackground} />
            </View>
          </TouchableRipple>

          <TouchableRipple onPress={() => handleNavigation("/settings/reviews")} rippleColor="rgba(0,0,0,0.1)">
            <List.Item title="Reviews" titleStyle={[styles.listItemTitle, { color: theme.colors.onBackground }]} style={styles.listItem} />
          </TouchableRipple>

          <TouchableRipple onPress={() => handleNavigation("/settings/support")} rippleColor="rgba(0,0,0,0.1)">
            <List.Item title="Support" titleStyle={[styles.listItemTitle, { color: theme.colors.onBackground }]} style={styles.listItem} />
          </TouchableRipple>

          <TouchableRipple onPress={() => handleNavigation("/settings/feedback")} rippleColor="rgba(0,0,0,0.1)">
            <List.Item title="feedback" titleStyle={[styles.listItemTitle, { color: theme.colors.onBackground }]} style={styles.listItem} />
          </TouchableRipple>

          <TouchableRipple onPress={() => handleNavigation("/settings/gift-cards")} rippleColor="rgba(0,0,0,0.1)">
            <List.Item title="Gift Cards" titleStyle={[styles.listItemTitle, { color: theme.colors.onBackground }]} style={styles.listItem} />
          </TouchableRipple>

          <TouchableRipple onPress={() => handleNavigation("/settings/about")} rippleColor="rgba(0,0,0,0.1)">
            <List.Item title="About" titleStyle={[styles.listItemTitle, { color: theme.colors.onBackground }]} style={styles.listItem} />
          </TouchableRipple>
        </View>

        {/* Logout - Enhanced with loading state and better UX */}
        <View style={styles.logoutSection}>
          <TouchableRipple 
            onPress={handleLogout} 
            rippleColor="rgba(0,0,0,0.1)"
            disabled={loggingOut}
          >
            <View style={[
              styles.logoutItem, 
              loggingOut && { opacity: 0.6 }
            ]}>
              <Text style={[
                styles.logoutText, 
                { color: theme.colors.onBackground }
              ]}>
                {loggingOut ? "Signing out..." : "Log Out"}
              </Text>
              <IconButton 
                icon={loggingOut ? "loading" : "arrow-right"} 
                size={24} 
                iconColor={theme.colors.onBackground}
                disabled={loggingOut}
              />
            </View>
          </TouchableRipple>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 48,
  },
  gearIcon: { marginRight: 8 },
  headerTitle: { fontSize: 24, fontWeight: "bold" },
  scrollView: { flex: 1, paddingHorizontal: 16 },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 16 },
  listItem: { paddingHorizontal: 0, paddingVertical: 8 },
  listItemTitle: { fontSize: 16, fontWeight: "400" },
  notificationRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
  languageItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, paddingHorizontal: 4 },
  languageLabel: { fontSize: 16, marginBottom: 4 },
  languageValue: { fontSize: 16, fontWeight: "500" },
  othersItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, paddingHorizontal: 4 },
  logoutSection: { marginTop: 16, marginBottom: 24 },
  logoutItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 16, paddingHorizontal: 4 },
  logoutText: { fontSize: 18, fontWeight: "500" },
});