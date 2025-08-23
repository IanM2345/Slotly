"use client";

import { useState } from "react";
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { Text, TextInput, Button, useTheme, Surface, IconButton } from "react-native-paper";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

// API + Session
import { login, meHeartbeat } from "../../lib/api/modules/auth";
import { useSession } from "../../context/SessionContext";

// Flip this to true in prod if you want password strictly required
const REQUIRE_PASSWORD = process.env.EXPO_PUBLIC_REQUIRE_PASSWORD === "true";

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { setAuth } = useSession();

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; phone?: string; password?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const validateForm = () => {
    const newErrors: { email?: string; phone?: string; password?: string } = {};

    // Require at least one identifier: email OR phone
    if (!email.trim() && !phone.trim()) {
      newErrors.email = "Email or phone is required";
      newErrors.phone = "Email or phone is required";
    }

    if (email.trim() && !/\S+@\S+\.\S+/.test(email.trim())) {
      newErrors.email = "Please enter a valid email";
    }

    if (phone.trim() && !/^\+?[\d\s\-\(\)]{7,}$/.test(phone.trim())) {
      newErrors.phone = "Please enter a valid phone number";
    }

    if (REQUIRE_PASSWORD) {
      if (!password.trim()) newErrors.password = "Password is required";
      else if (password.length < 6) newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setServerError(null);

    try {
      const payload = {
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        password: password || "", // Always include password, even if empty
      };

      const res = await login(payload);

      if (res?.error) {
        setServerError(res.error || "Invalid credentials. Please try again.");
        return;
      }

      // Ensure SessionContext is updated (even though the module saved tokens)
      const user = res?.user ?? (await meHeartbeat());
      if (res?.token) {
        setAuth(res.token, {
          id: user?.id,
          email: user?.email,
          role: user?.role,
        });
      }

      const role = String(user?.role || "").toUpperCase();
      if (role === "BUSINESS_OWNER") {
        router.replace("/business/dashboard");
      } else {
        router.replace("/(tabs)");
      }
    } catch (e: any) {
      console.error("Login error:", e);
      setServerError(e?.response?.data?.error || e?.message || "Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => router.push("../auth/forgot-password");
  const handleCreateAccount = () => router.push("../auth/signup");
  const handleBack = () => router.back();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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

          <Surface style={[styles.formContainer, { backgroundColor: theme.colors.surface }]} elevation={2}>
            <View style={styles.form}>
              <TextInput
                mode="outlined"
                label="Email Address"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
                  if (serverError) setServerError(null);
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
                label="Phone Number"
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  if (errors.phone) setErrors((p) => ({ ...p, phone: undefined }));
                  if (serverError) setServerError(null);
                }}
                keyboardType="phone-pad"
                autoComplete="tel"
                error={!!errors.phone}
                style={styles.input}
                left={<TextInput.Icon icon="phone" />}
              />
              {errors.phone && (
                <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                  {errors.phone}
                </Text>
              )}

              <TextInput
                mode="outlined"
                label="Password"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
                  if (serverError) setServerError(null);
                }}
                secureTextEntry={!showPassword}
                autoComplete="password"
                error={!!errors.password}
                style={styles.input}
                left={<TextInput.Icon icon="lock" />}
                right={<TextInput.Icon icon={showPassword ? "eye-off" : "eye"} onPress={() => setShowPassword(!showPassword)} />}
              />
              {errors.password && (
                <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                  {errors.password}
                </Text>
              )}

              {serverError ? (
                <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>{serverError}</Text>
              ) : null}

              <Button mode="text" onPress={handleForgotPassword} style={styles.forgotButton} labelStyle={[styles.forgotButtonText, { color: theme.colors.primary }]}>
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
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 32,
  },
  backButton: {
    marginLeft: -8,
    marginRight: 8,
  },
  title: {
    fontWeight: "bold",
  },
  formContainer: {
    borderRadius: 16,
    marginBottom: 32,
  },
  form: {
    padding: 24,
  },
  input: {
    marginBottom: 8,
  },
  errorText: {
    marginBottom: 16,
    marginLeft: 12,
  },
  forgotButton: {
    alignSelf: "flex-end",
    marginBottom: 24,
  },
  forgotButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  signInButton: {
    borderRadius: 28,
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
    paddingBottom: 32,
  },
  footerText: {
    textAlign: "center",
  },
  linkText: {
    fontWeight: "600",
  },
});