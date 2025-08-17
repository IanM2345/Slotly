"use client"
import { View, StyleSheet } from "react-native"
import { Text, Button, Surface, useTheme } from "react-native-paper"
import { useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"

export default function AuthIndexScreen() {
  const theme = useTheme()
  const router = useRouter()

  const handleSignIn = () => {
    router.push("../auth/login")
  }

  const handleCreateAccount = () => {
    router.push("../auth/signup")
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <Surface style={[styles.logoContainer, { backgroundColor: theme.colors.primaryContainer }]} elevation={3}>
            <Text style={[styles.logoText, { color: theme.colors.primary }]}>SLOTLY</Text>
          </Surface>
          <Text style={[styles.tagline, { color: theme.colors.onBackground }]}>Appointments, Simplified</Text>
        </View>

        {/* Welcome Text */}
        <View style={styles.welcomeSection}>
          <Text variant="headlineMedium" style={[styles.welcomeTitle, { color: theme.colors.onBackground }]}>
            Welcome to Slotly
          </Text>
         
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonSection}>
          <Button
            mode="contained"
            onPress={handleSignIn}
            style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
          >
            Sign In
          </Button>

          <Button
            mode="outlined"
            onPress={handleCreateAccount}
            style={[styles.secondaryButton, { borderColor: theme.colors.outline }]}
            contentStyle={styles.buttonContent}
            labelStyle={[styles.buttonLabel, { color: theme.colors.primary }]}
          >
            Create Account
          </Button>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text variant="bodySmall" style={[styles.footerText, { color: theme.colors.onSurfaceVariant }]}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  logoSection: {
    alignItems: "center",
    marginBottom: 48,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  logoText: {
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 14,
    fontWeight: "500",
  },
  welcomeSection: {
    alignItems: "center",
    marginBottom: 48,
  },
  welcomeTitle: {
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 12,
  },
  welcomeSubtitle: {
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  buttonSection: {
    gap: 16,
    marginBottom: 32,
  },
  primaryButton: {
    borderRadius: 28,
  },
  secondaryButton: {
    borderRadius: 28,
    borderWidth: 1.5,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    alignItems: "center",
  },
  footerText: {
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 32,
  },
})
