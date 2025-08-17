import FontAwesome from "@expo/vector-icons/FontAwesome";
import { DefaultTheme as NavDefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Provider as PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { MD3Theme } from "react-native-paper";

import { slotlyTheme } from "./theme/paper";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "(tabs)",
  ssr: false,
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...FontAwesome.font,
  });

  useEffect(() => {
    SplashScreen.preventAutoHideAsync();
  }, []);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (error) throw error;
  if (!loaded) return null;

  // React Navigation theme mapped to our Paper theme colors
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
      <PaperProvider theme={slotlyTheme as MD3Theme}>
        <ThemeProvider value={navTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="modal" options={{ presentation: "modal" }} />
          </Stack>
        </ThemeProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}