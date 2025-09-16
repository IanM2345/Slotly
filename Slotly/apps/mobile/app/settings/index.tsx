// apps/mobile/app/settings/index.tsx
import React, { useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, Alert } from "react-native";
import {
  Text,
  Surface,
  List,
  Switch,
  IconButton,
  TouchableRipple,
  Button,
  useTheme,
  ActivityIndicator,
} from "react-native-paper";
import { useRouter } from "expo-router";
import { useSession } from "../../context/SessionContext";
import { getNotificationsEnabled, setNotificationsEnabled } from "../../lib/settings/api";
import { meHeartbeat } from "../../lib/api/modules/auth";

// Import Sentry conditionally to avoid the __extends error
let Sentry: any = null;
try {
  Sentry = require("sentry-expo");
} catch (error) {
  console.warn("Sentry import failed:", error);
}

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { token, user, setUser, signOut } = useSession();
  const [notificationsEnabledState, setNotificationsEnabledState] = useState(true);
  const [verifyingRole, setVerifyingRole] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    getNotificationsEnabled()
      .then(setNotificationsEnabledState)
      .catch(() => {
        // Silently fail, keep default state
      });
  }, []);

  const ONBOARDING_START = "/business/onboarding" as const;

  const handleBack = () => router.replace('/(tabs)/profile' as any);

  // Better navigation helper with error handling
  const handleNavigation = (route: string) => {
    try {
      router.push(route as any);
    } catch (error) {
      console.error("Navigation error:", error);
      Alert.alert("Navigation Error", "Unable to navigate to that page.");
    }
  };

  // Role verification from backend using current token
  useEffect(() => {
    let mounted = true;
    
    const verifyRole = async () => {
      if (!token) return;
      
      try {
        setVerifyingRole(true);
        const fresh = await meHeartbeat();
        
        if (mounted && fresh) {
          // Merge server data with client state, prefer server data
          setUser(prevUser => ({
            ...(prevUser ?? {}),
            ...fresh,
          }));
        }
      } catch (e: any) {
        console.error("Role verification failed:", e?.message);
        
        // Don't show error to user for role verification failures
        // Just capture for monitoring
        if (Sentry?.Native?.captureException) {
          Sentry.Native.captureException(e);
        }
        
        // If it's an auth error, might need to logout
        if (e?.response?.status === 401) {
          console.warn("Authentication expired during role check");
          // Could trigger logout here if needed
        }
      } finally {
        if (mounted) {
          setVerifyingRole(false);
        }
      }
    };

    verifyRole();
    
    return () => { 
      mounted = false; 
    };
  }, [token, setUser]);

  // Role-aware primary action
  const role = user?.role; // 'CUSTOMER' | 'STAFF' | 'BUSINESS_OWNER' | 'ADMIN'
  
  const getButtonTitle = (userRole?: string) => {
    switch (userRole) {
      case "CUSTOMER": 
        return "Switch to Business Account";
      case "STAFF": 
        return "Go to Staff Dashboard";
      case "BUSINESS_OWNER": 
        return "Go to Business Dashboard";
      case "ADMIN": 
        return "Open Admin Console";
      default: 
        return "Verify Account";
    }
  };

  const handlePrimaryAction = () => {
    try {
      switch (role) {
        case "CUSTOMER":
          return handleSwitchToBusiness();
        case "STAFF":
          return router.push("/business/dashboard/staff" as any);
        case "BUSINESS_OWNER":
          return router.push("/business/dashboard" as any);
        case "ADMIN":
          return router.push("/admin" as any);
        default:
          return router.push("/business/onboarding" as any);
      }
    } catch (error) {
      console.error("Primary action error:", error);
      Alert.alert("Navigation Error", "Unable to perform that action.");
    }
  };

  // Improved business account switching
  const handleSwitchToBusiness = async () => {
    try {
      setVerifyingRole(true);
      
      // Update local state
      setUser(prevUser => ({
        ...(prevUser ?? { accountType: "consumer" as const }),
        accountType: "business" as const,
        business: { 
          ...(prevUser?.business ?? {}), 
          verificationStatus: "unverified" as const
        },
      }));
      
      // Navigate to onboarding
      router.push(ONBOARDING_START as any);
      
    } catch (error) {
      console.error("Switch to business error:", error);
      Alert.alert("Error", "Unable to switch to business account. Please try again.");
    } finally {
      setVerifyingRole(false);
    }
  };

  // Better notification settings handling
  const handleNotificationToggle = async (enabled: boolean) => {
    const previousState = notificationsEnabledState;
    
    // Optimistic update
    setNotificationsEnabledState(enabled);
    
    try {
      await setNotificationsEnabled(enabled);
    } catch (error) {
      // Revert on error
      setNotificationsEnabledState(previousState);
      
      Alert.alert(
        "Settings Error",
        "Failed to update notification settings. Please try again."
      );
      
      console.error("Notification settings error:", error);
    }
  };

  // Complete logout with confirmation
  const handleLogout = async () => {
    if (loggingOut) return;
    
    // Add confirmation dialog
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            await performLogout();
          },
        },
      ]
    );
  };

  const performLogout = async () => {
    setLoggingOut(true);
    try {
      console.log("Logging out...");
      
      // Call the centralized signOut from SessionContext
      // This will:
      // 1. Call the backend /api/auth/logout (revokes refresh tokens)
      // 2. Clear tokens from SecureStore 
      // 3. Clear in-memory session state
      // 4. Clear Sentry user context
      await signOut();
      
      console.log("Logout completed successfully");
      
      // Navigate to login screen - using absolute path
      router.replace("/(auth)/login" as any);
      
    } catch (error) {
      console.error("Logout error:", error);
      
      // Show user-friendly error message
      Alert.alert(
        "Logout Error", 
        "There was an issue signing out. Please try again.",
        [{ text: "OK" }]
      );
      
      // Capture for monitoring but don't block logout
      if (Sentry?.Native?.captureException) {
        Sentry.Native.captureException(error);
      }
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.background }]}>
        <IconButton 
          icon="arrow-left" 
          size={24} 
          iconColor={theme.colors.onBackground} 
          onPress={handleBack} 
        />
        <View style={styles.headerContent}>
          <IconButton 
            icon="cog" 
            size={28} 
            iconColor={theme.colors.onBackground} 
            style={styles.gearIcon} 
          />
          <Text style={[styles.headerTitle, { color: theme.colors.onBackground }]}>
            Settings
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Business section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
            Business
          </Text>
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

              {/* Role status line */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {verifyingRole && <ActivityIndicator size={16} />}
                <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
                  {verifyingRole 
                    ? "Verifying role..." 
                    : `Signed in as ${role?.toLowerCase().replace('_', ' ') ?? "unknown role"}`}
                </Text>
              </View>

              <Button
                mode="contained"
                onPress={role === "CUSTOMER" ? handleSwitchToBusiness : handlePrimaryAction}
                disabled={verifyingRole}
                style={{ borderRadius: 28, marginTop: 4 }}
                contentStyle={{ paddingVertical: 8 }}
                labelStyle={{ fontWeight: "700", color: theme.colors.primary }}
                buttonColor={"#FBC02D"}
              >
                {getButtonTitle(role)}
              </Button>
            </View>
          </Surface>
        </View>
      
    

        {/* Language */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
            Language
          </Text>

          <TouchableRipple 
            onPress={() => handleNavigation("/settings/language")} 
            rippleColor="rgba(0,0,0,0.1)"
          >
            <View style={styles.languageItem}>
              <View>
                <Text style={[styles.languageLabel, { color: theme.colors.onBackground }]}>
                  Language:
                </Text>
                <Text style={[styles.languageValue, { color: theme.colors.onBackground }]}>
                  Automatic(English)
                </Text>
              </View>
              <IconButton 
                icon="chevron-right" 
                size={24} 
                iconColor={theme.colors.onBackground} 
              />
            </View>
          </TouchableRipple>

      
        </View>

        {/* Others */}
        <View style={styles.section}>
         

          
          <TouchableRipple 
            onPress={() => handleNavigation("/settings/reviews")} 
            rippleColor="rgba(0,0,0,0.1)"
          >
            <List.Item 
              title="Reviews" 
              titleStyle={[styles.listItemTitle, { color: theme.colors.onBackground }]} 
              style={styles.listItem} 
            />
          </TouchableRipple>

          <TouchableRipple 
            onPress={() => handleNavigation("/settings/support")} 
            rippleColor="rgba(0,0,0,0.1)"
          >
            <List.Item 
              title="Support" 
              titleStyle={[styles.listItemTitle, { color: theme.colors.onBackground }]} 
              style={styles.listItem} 
            />
          </TouchableRipple>

          <TouchableRipple 
            onPress={() => handleNavigation("/settings/feedback")} 
            rippleColor="rgba(0,0,0,0.1)"
          >
            <List.Item 
              title="Feedback" 
              titleStyle={[styles.listItemTitle, { color: theme.colors.onBackground }]} 
              style={styles.listItem} 
            />
          </TouchableRipple>

          <TouchableRipple 
            onPress={() => handleNavigation("/settings/about")} 
            rippleColor="rgba(0,0,0,0.1)"
          >
            <List.Item 
              title="About" 
              titleStyle={[styles.listItemTitle, { color: theme.colors.onBackground }]} 
              style={styles.listItem} 
            />
          </TouchableRipple>
        </View>

        {/* Logout - Enhanced with loading state and confirmation */}
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
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                {loggingOut && <ActivityIndicator size={16} style={{ marginRight: 8 }} />}
                <Text style={[
                  styles.logoutText, 
                  { color: theme.colors.onBackground }
                ]}>
                  {loggingOut ? "Signing out..." : "Log Out"}
                </Text>
              </View>
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
  container: { 
    flex: 1 
  },
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
  gearIcon: { 
    marginRight: 8 
  },
  headerTitle: { 
    fontSize: 24, 
    fontWeight: "bold" 
  },
  scrollView: { 
    flex: 1, 
    paddingHorizontal: 16 
  },
  section: { 
    marginBottom: 32 
  },
  sectionTitle: { 
    fontSize: 20, 
    fontWeight: "bold", 
    marginBottom: 16 
  },
  listItem: { 
    paddingHorizontal: 0, 
    paddingVertical: 8 
  },
  listItemTitle: { 
    fontSize: 16, 
    fontWeight: "400" 
  },
  notificationRow: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center", 
    paddingVertical: 12 
  },
  languageItem: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center", 
    paddingVertical: 12, 
    paddingHorizontal: 4 
  },
  languageLabel: { 
    fontSize: 16, 
    marginBottom: 4 
  },
  languageValue: { 
    fontSize: 16, 
    fontWeight: "500" 
  },
  othersItem: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center", 
    paddingVertical: 12, 
    paddingHorizontal: 4 
  },
  logoutSection: { 
    marginTop: 16, 
    marginBottom: 24 
  },
  logoutItem: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center", 
    paddingVertical: 16, 
    paddingHorizontal: 4 
  },
  logoutText: { 
    fontSize: 18, 
    fontWeight: "500" 
  },
});