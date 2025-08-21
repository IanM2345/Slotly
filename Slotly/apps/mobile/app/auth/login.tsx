"use client";

import { useState } from "react";
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import {
  Text,
  TextInput,
  Button,
  useTheme,
  Surface,
  IconButton,
  SegmentedButtons,
} from "react-native-paper";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

// ⬇️ If your login is at /app/login.tsx, change to: "../context/SessionContext"
import { useSession } from "../../context/SessionContext";

type RoleValue = "consumer" | "business" | "staff";

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { setUser } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<RoleValue>("consumer"); // 👈 dev-only role picker
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email.trim()) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = "Please enter a valid email";

    if (!password.trim()) newErrors.password = "Password is required";
    else if (password.length < 6) newErrors.password = "Password must be at least 6 characters";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1200));

      // ✅ Set the session with the role; gate at "/" will redirect accordingly
      setUser({
        id: "dev-" + Math.floor(Math.random() * 1e6),
        userId: "u" + Math.floor(Math.random() * 9000 + 1000),
        email,
        accountType: role,
        business: role === "business" ? { verificationStatus: "approved", tier: 2 } : undefined,
      });

      // Let the role gate decide where to go (/(tabs) | /business/dashboard | /business/dashboard/staff)
      router.replace("/");
    } catch (error) {
      console.error("Login error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    // keep your existing route
    router.push("../auth/forgot-password");
  };

  const handleCreateAccount = () => {
    // keep your existing route
    router.push("../auth/signup");
  };

  const handleBack = () => router.back();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <IconButton
              icon="arrow-left"
              size={24}
              iconColor={theme.colors.onBackground}
              onPress={handleBack}
              style={styles.backButton}
            />
            <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onBackground }]}>
              Sign In
            </Text>
          </View>

          {/* Form */}
          <Surface style={[styles.formContainer, { backgroundColor: theme.colors.surface }]} elevation={2}>
            <View style={styles.form}>
              <TextInput
                mode="outlined"
                label="Email Address"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                error={!!errors.email}
                style={styles.input}
                left={<TextInput.Icon icon="email" />}
              />
              {errors.email && (
                <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                  {errors.email}
                </Text>
              )}

              <TextInput
                mode="outlined"
                label="Password"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                }}
                secureTextEntry={!showPassword}
                autoComplete="password"
                error={!!errors.password}
                style={styles.input}
                left={<TextInput.Icon icon="lock" />}
                right={
                  <TextInput.Icon
                    icon={showPassword ? "eye-off" : "eye"}
                    onPress={() => setShowPassword(!showPassword)}
                  />
                }
              />
              {errors.password && (
                <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                  {errors.password}
                </Text>
              )}

              {/* Dev-only role selector (remove when backend returns the role) */}
              <View style={{ marginTop: 8, marginBottom: 16 }}>
                <Text variant="labelLarge" style={{ marginBottom: 6 }}>
                  Sign in as
                </Text>
                <SegmentedButtons
                  value={role}
                  onValueChange={(v) => setRole(v as RoleValue)}
                  buttons={[
                    { value: "consumer", label: "Customer", icon: "account" },
                    { value: "business", label: "Business", icon: "briefcase" },
                    { value: "staff", label: "Staff", icon: "account-tie" },
                  ]}
                />
              </View>

              <Button
                mode="text"
                onPress={handleForgotPassword}
                style={styles.forgotButton}
                labelStyle={[styles.forgotButtonText, { color: theme.colors.primary }]}
              >
                Forgot Password?
              </Button>

              <Button
                mode="contained"
                onPress={handleSignIn}
                loading={loading}
                disabled={loading}
                style={[styles.signInButton, { backgroundColor: theme.colors.primary }]}
                contentStyle={styles.buttonContent}
                labelStyle={styles.buttonLabel}
              >
                Sign In
              </Button>
            </View>
          </Surface>

          {/* Footer */}
          <View style={styles.footer}>
            <Text variant="bodyMedium" style={[styles.footerText, { color: theme.colors.onSurfaceVariant }]}>
              Don't have an account?{" "}
              <Text style={[styles.linkText, { color: theme.colors.primary }]} onPress={handleCreateAccount}>
                Create Account
              </Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24 },
  header: { flexDirection: "row", alignItems: "center", paddingTop: 16, paddingBottom: 32 },
  backButton: { marginLeft: -8, marginRight: 8 },
  title: { fontWeight: "bold" },
  formContainer: { borderRadius: 16, marginBottom: 32 },
  form: { padding: 24 },
  input: { marginBottom: 8 },
  errorText: { marginBottom: 16, marginLeft: 12 },
  forgotButton: { alignSelf: "flex-end", marginBottom: 24 },
  forgotButtonText: { fontSize: 14, fontWeight: "600" },
  signInButton: { borderRadius: 28 },
  buttonContent: { paddingVertical: 8 },
  buttonLabel: { fontSize: 16, fontWeight: "600" },
  footer: { alignItems: "center", paddingBottom: 32 },
  footerText: { textAlign: "center" },
  linkText: { fontWeight: "600" },
});
