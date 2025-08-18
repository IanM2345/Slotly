"use client";

import { Stack } from "expo-router";
import { SessionProvider } from "../../../context/SessionContext";            // ← your file
import { OnboardingProvider } from "../../../context/OnboardingContext";      // ← new file

export default function OnboardingLayout() {
  return (
    <SessionProvider>
      <OnboardingProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </OnboardingProvider>
    </SessionProvider>
  );
}
