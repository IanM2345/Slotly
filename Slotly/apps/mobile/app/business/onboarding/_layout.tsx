// apps/mobile/app/business/onboarding/_layout.tsx
"use client";

import { Stack, Slot, Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { View, ActivityIndicator, Platform } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { meHeartbeat, refreshSession, clearSession } from "../../../lib/api/modules/auth";
import { useSession } from "../../../context/SessionContext";
import { OnboardingProvider } from "../../../context/OnboardingContext";

export default function OnboardingLayout() {
  const { token } = useSession();
  const theme = useTheme();
  const [status, setStatus] = useState<"checking" | "ok" | "unauth">("checking");

  useEffect(() => {
    let mounted = true;

    const checkAuthentication = async () => {
      // No token at all - redirect immediately
      if (!token) {
        if (mounted) setStatus("unauth");
        return;
      }

      try {
        // Try to verify current token
        await meHeartbeat();
        if (mounted) setStatus("ok");
      } catch (error) {
        // Token might be expired - try to refresh once
        try {
          await refreshSession();
          await meHeartbeat();
          if (mounted) setStatus("ok");
        } catch (refreshError) {
          // Both original token and refresh failed
          // Clear any stale tokens and redirect to login
          await clearSession();
          if (mounted) setStatus("unauth");
        }
      }
    };

    checkAuthentication();

    return () => {
      mounted = false;
    };
  }, [token]);

  // Redirect to login with next parameter
  if (status === "unauth") {
    return <Redirect href="/auth/login?next=/business/onboarding" />;
  }

  // Show loading state while checking authentication
  if (status === "checking") {
    return (
      <View style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: theme.colors.background
      }}>
        <ActivityIndicator 
          size="large" 
          color={theme.colors.primary}
          style={{ marginBottom: 16 }}
        />
        <Text 
          variant="bodyMedium" 
          style={{ color: theme.colors.onBackground }}
        >
          Verifying authentication...
        </Text>
      </View>
    );
  }

  // Authentication verified - render the onboarding screens with Stack navigation
  return (
    <OnboardingProvider>
      <Stack
        screenOptions={{
          // iOS: let KeyboardAvoidingView manage keyboard layout
          // This prevents React Navigation from fighting with KeyboardAvoidingView
          keyboardHandlingEnabled: Platform.OS === "ios" ? false : undefined,
          // You can also add other common screen options here
          headerShown: true,
          headerBackVisible: true,
          headerTitleAlign: 'center',
        }}
      >
        <Stack.Screen 
          name="index" 
          options={{ 
            title: "Business Registration",
            headerShown: true 
          }} 
        />
        {/* Add other onboarding screens here as needed */}
      </Stack>
    </OnboardingProvider>
  );
}