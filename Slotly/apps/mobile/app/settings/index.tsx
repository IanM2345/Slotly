// apps/mobile/app/settings/index.tsx
"use client";

import React, { useEffect, useState } from "react";
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

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, setUser } = useSession();
  const [notificationsEnabledState, setNotificationsEnabledState] = useState(true);

  useEffect(() => {
    getNotificationsEnabled().then(setNotificationsEnabledState).catch(() => {});
  }, []);

  const ONBOARDING_START = "/business/onboarding" as const;

  const handleBack = () => router.back();
  const handleNavigation = (route: string) => {
    // Keep your existing loose navigation helper
    router.push(route as any);
  };

  const handleLogout = () => {
    console.log("Logging out...");
    // router.replace('/login');
  };

  const handleSwitchToBusiness = () => {
    // Flip session locally (backend partner will persist)
    setUser({
      ...(user ?? { accountType: "consumer" }),
      accountType: "business",
      business: {
        ...(user?.business ?? {}),
        verificationStatus: "unverified",
      },
    });

    // Typed routes may not be available in this file; cast to satisfy TS
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
            <Text
              style={{
                color: theme.colors.onSurfaceVariant,
                marginBottom: 12,
              }}
            >
              Run your services on Slotly with bookings, payments and analytics.
            </Text>

            <Button
              mode="contained"
              onPress={handleSwitchToBusiness}
              style={{ borderRadius: 28 }}
              contentStyle={{ paddingVertical: 8 }}
              labelStyle={{ fontWeight: "700", color: theme.colors.primary }}
              buttonColor={"#FBC02D"}
            >
              Switch to Business Account
            </Button>
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

        {/* Logout */}
        <View style={styles.logoutSection}>
          <TouchableRipple onPress={handleLogout} rippleColor="rgba(0,0,0,0.1)">
            <View style={styles.logoutItem}>
              <Text style={[styles.logoutText, { color: theme.colors.onBackground }]}>Log Out</Text>
              <IconButton icon="arrow-right" size={24} iconColor={theme.colors.onBackground} />
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
