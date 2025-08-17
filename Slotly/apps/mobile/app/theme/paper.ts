import { MD3LightTheme } from "react-native-paper"
import type { MD3Theme } from "react-native-paper"

export const palette = {
  // Blue (Primary)
  blue: {
    50: "#F5F9FF",
    100: "#E6F0FF",
    400: "#5AA1FF",
    500: "#2A7FFF",
    600: "#1C6FE3",
    700: "#1559C1", // Primary
    800: "#0D47A1",
    900: "#08306B",
  },
  
  // Orange (Secondary/CTA)
  orange: {
    50: "#FFF6EE",
    100: "#FFE8D1",
    400: "#FFB26B",
    500: "#FF8A1E",
    600: "#F57C00", // Secondary
    700: "#E66400",
    800: "#C65000",
    900: "#7A2E00",
  },
  
  // Semantic
  success: "#2E7D32",
  danger: "#C62828",
  warning: "#FBC02D",
  info: "#0288D1",
  
  // Grayscale
  gray: {
    50: "#F8FAFC",
    100: "#F1F5F9",
    200: "#E5E7EB",
    300: "#D1D5DB",
    400: "#9CA3AF",
    500: "#6B7280",
    600: "#4B5563",
    700: "#374151",
    800: "#1F2937",
    900: "#0F172A",
  },
}

// Create the theme with custom colors
export const slotlyTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    
    // Primary (Blue)
    primary: palette.blue[700],
    onPrimary: "#FFFFFF",
    primaryContainer: palette.blue[100],
    onPrimaryContainer: palette.blue[900],
    
    // Secondary (Orange)
    secondary: palette.orange[600],
    onSecondary: "#FFFFFF",
    secondaryContainer: palette.orange[100],
    onSecondaryContainer: palette.orange[900],
    
    // Error (Danger)
    error: palette.danger,
    onError: "#FFFFFF",
    errorContainer: "#FCE4E4",
    onErrorContainer: "#5B1212",
    
    // Custom semantic colors
    success: palette.success,
    onSuccess: "#FFFFFF",
    warning: palette.warning,
    onWarning: "#000000",
    info: palette.info,
    onInfo: "#FFFFFF",
    
    // Surface colors
    background: palette.gray[50],
    surface: "#FFFFFF",
    surfaceVariant: palette.gray[100],
    onSurface: palette.gray[800],
    onSurfaceVariant: palette.gray[700],
    
    // Outline
    outline: palette.gray[300],
    outlineVariant: palette.gray[200],
  },
} as const

export type SlotlyTheme = typeof slotlyTheme

// Default export to satisfy router requirements
export default slotlyTheme

// Module augmentation for react-native-paper
declare module "react-native-paper" {
  interface MD3Colors {
    success: string
    warning: string
    info: string
    onSuccess: string
    onWarning: string
    onInfo: string
  }
}