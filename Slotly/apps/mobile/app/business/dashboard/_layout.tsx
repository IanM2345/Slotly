// apps/mobile/app/business/dashboard/_layout.tsx
"use client";
import { slotlyTheme } from "../../../theme/paper";
import { Stack, Redirect } from "expo-router";
import { TierProvider } from "../../../context/TierContext";
import { VerificationProvider } from "../../../context/VerificationContext";
import { useSession } from "../../../context/SessionContext";

export default function DashboardLayout() {
  const { user } = useSession();

  if (!user) return <Redirect href="/login" />;
  if (user.accountType !== "business") return <Redirect href="/" />;

  return (
    <TierProvider initialTier="level4">
      <VerificationProvider initialStatus="verified">
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="staff" />
          <Stack.Screen name="bookings" />
          <Stack.Screen name="analytics" />
          <Stack.Screen name="staff/index" />
          <Stack.Screen name="staff/[id]" />
          <Stack.Screen name="staff/applications" />
          <Stack.Screen name="bookings/manage" />
          <Stack.Screen name="services/index" />
          <Stack.Screen name="coupons" />
          <Stack.Screen name="reports" />
          <Stack.Screen name="billing" />
        </Stack>
      </VerificationProvider>
    </TierProvider>
  );
}
