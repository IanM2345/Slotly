import { MD3LightTheme, configureFonts } from "react-native-paper";

// Inter font mapping aligned with MD3 typescale
const interConfig = {
    displayLarge:   { fontFamily: "Inter_800ExtraBold" },
    displayMedium:  { fontFamily: "Inter_800ExtraBold" },
    displaySmall:   { fontFamily: "Inter_700Bold" },

    headlineLarge:  { fontFamily: "Inter_700Bold" },
    headlineMedium: { fontFamily: "Inter_700Bold" },
    headlineSmall:  { fontFamily: "Inter_600SemiBold" },

    titleLarge:     { fontFamily: "Inter_700Bold" },
    titleMedium:    { fontFamily: "Inter_600SemiBold" },
    titleSmall:     { fontFamily: "Inter_600SemiBold" },

    labelLarge:     { fontFamily: "Inter_600SemiBold" },
    labelMedium:    { fontFamily: "Inter_600SemiBold" },
    labelSmall:     { fontFamily: "Inter_500Medium" },

    bodyLarge:      { fontFamily: "Inter_400Regular" },
    bodyMedium:     { fontFamily: "Inter_400Regular" },
    bodySmall:      { fontFamily: "Inter_400Regular" },
} as const;

const fonts = configureFonts({ config: interConfig });

// Wireframe-derived palette tokens (sampled; adjust to exact asset values as needed)
export const wireframePalette = {
    primary: "#1C3FAA", // royal/deep blue
    onPrimary: "#FFFFFF",
    secondary: "#F5B400", // yellow/gold
    onSecondary: "#1C1C1C",
    background: "#F7F8FA", // light background
    surface: "#FFFFFF",
    onSurface: "#1F2937",
    outline: "#E2E8F0",
    success: "#22C55E",
    error: "#EF4444",
    warning: "#F59E0B",
    // state/interaction variants
    primaryContainer: "#E7EDFF",
    onPrimaryContainer: "#0A1C5A",
    secondaryContainer: "#FFF4CC",
    onSecondaryContainer: "#4A3B00",
    surfaceVariant: "#F2F4F7",
    onSurfaceVariant: "#4B5563",
} as const;

export const wireframeTheme = {
    ...MD3LightTheme,
    colors: {
        ...MD3LightTheme.colors,
        primary: wireframePalette.primary,
        onPrimary: wireframePalette.onPrimary,
        primaryContainer: wireframePalette.primaryContainer,
        onPrimaryContainer: wireframePalette.onPrimaryContainer,

        secondary: wireframePalette.secondary,
        onSecondary: wireframePalette.onSecondary,
        secondaryContainer: wireframePalette.secondaryContainer,
        onSecondaryContainer: wireframePalette.onSecondaryContainer,

        error: wireframePalette.error,
        onError: "#FFFFFF",
        errorContainer: "#FEE2E2",
        onErrorContainer: "#7F1D1D",

        // custom semantic
        success: wireframePalette.success,
        onSuccess: "#FFFFFF",
        warning: wireframePalette.warning,
        onWarning: "#1F2937",

        background: wireframePalette.background,
        surface: wireframePalette.surface,
        surfaceVariant: wireframePalette.surfaceVariant,
        onSurface: wireframePalette.onSurface,
        onSurfaceVariant: wireframePalette.onSurfaceVariant,

        outline: wireframePalette.outline,
        outlineVariant: "#CBD5E1",
    },
    fonts,
} as const;

export type WireframeTheme = typeof wireframeTheme;


