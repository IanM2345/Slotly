"use client";
import { Redirect } from "expo-router";
import { ActivityIndicator } from "react-native-paper";
import { useSession } from "../context/SessionContext";

export default function RoleGate() {
  const { user } = useSession();

  // While you’re wiring real auth, if user is null send to your login
  if (!user) return <Redirect href="/login" />;

  if (user.accountType === "business") return <Redirect href="/business/dashboard" />;
  if (user.accountType === "staff") return <Redirect href="/business/dashboard/staff" />;

  // default: consumer app
  return <Redirect href="/(tabs)" />;
}
