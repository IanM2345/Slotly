// apps/mobile/app/business/dashboard/_layout.tsx - Backup option with PaperProvider
"use client";

import { Stack, Redirect } from "expo-router";
import { Provider as PaperProvider, MD3LightTheme } from "react-native-paper";
import { TierProvider } from "../../../context/TierContext";
import { VerificationProvider } from "../../../context/VerificationContext";
import { useSession } from "../../../context/SessionContext";

export default function DashboardLayout() {
  const { user, ready } = useSession();

  // Wait for session to be ready before making routing decisions
  if (!ready) {
    return null; // or a loading component
  }

  // Redirect to auth if not logged in
  if (!user) {
    console.log("No user in dashboard layout, redirecting to auth");
    return <Redirect href="/auth/login" />;
  }

  // Redirect if not a business owner
  if (user.role !== "BUSINESS_OWNER" && user.role !== "STAFF") {
    console.log("Non-business user accessing dashboard, redirecting to home");
    return <Redirect href="/" />;
  }

  console.log("Business dashboard layout loaded for:", user.email);

  return (
    <PaperProvider theme={MD3LightTheme}>
      <TierProvider initialTier="level4">
        <VerificationProvider initialStatus="verified">
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="staff" />
            <Stack.Screen name="team" />
            <Stack.Screen name="analytics" />
            <Stack.Screen name="bookings/manage" />
            <Stack.Screen name="services/services" />
            <Stack.Screen name="services/bundle/new-bundle" />
            <Stack.Screen name="services/create-service/new" />
            <Stack.Screen name="coupons" />
            <Stack.Screen name="reports" />
            <Stack.Screen name="billing" />
          </Stack>
        </VerificationProvider>
      </TierProvider>
    </PaperProvider>
  );
}