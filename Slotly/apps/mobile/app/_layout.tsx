/* apps/mobile/app/_layout.tsx */
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { DefaultTheme as NavDefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Provider as PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { MD3Theme } from "react-native-paper";

import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";

// ✅ theme is OUTSIDE app/ so expo-router doesn’t scan it as a route
import { slotlyTheme } from "./theme/paper";
import { wireframeTheme } from "./theme/wireframe";

// Context providers
import { SessionProvider } from "../context/SessionContext";
import { OnboardingProvider } from "../context/OnboardingContext";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "index", // role gate runs first
  ssr: false,
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    ...FontAwesome.font,
  });

  useEffect(() => {
    SplashScreen.preventAutoHideAsync();
  }, []);

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (error) throw error;
  if (!loaded) return null;

  const navTheme = {
    ...NavDefaultTheme,
    colors: {
      ...NavDefaultTheme.colors,
      primary: slotlyTheme.colors.primary,
      background: slotlyTheme.colors.background,
      card: slotlyTheme.colors.surface,
      text: slotlyTheme.colors.onSurface,
      border: slotlyTheme.colors.outline,
      notification: slotlyTheme.colors.secondary,
    },
  };

  return (
    <SafeAreaProvider>
      <SessionProvider>
        <OnboardingProvider>
          <PaperProvider theme={slotlyTheme as MD3Theme}>
            <ThemeProvider value={navTheme}>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />     {/* ← role gate */}
                {/* Tabs (consumer) are wrapped with wireframe theme inside their own layout */}
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="modal" options={{ presentation: "modal" }} />
                {/* Non-tabs consumer flows get explicit wireframe theme providers inside their layouts */}
              </Stack>
            </ThemeProvider>
          </PaperProvider>
        </OnboardingProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
