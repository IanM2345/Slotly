import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { Text, TextInput, Button, useTheme, Surface, IconButton } from "react-native-paper";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

// API + Session
import { login, meHeartbeat } from "../../lib/api/modules/auth";
import { useSession, SessionUser } from "../../context/SessionContext";

const REQUIRE_PASSWORD = process.env.EXPO_PUBLIC_REQUIRE_PASSWORD === "true";

// ---- helpers ---------------------------------------------------------------
const isApproved = (status?: string) => {
  const s = String(status || "").toLowerCase();
  return s === "approved" || s === "active" || s === "verified";
};

const pickStatus = (b?: any) =>
  (b?.verification?.status ??
    b?.verificationStatus ??
    b?.status ??
    b?.verification_status ??
    undefined) as string | undefined;

function getPostLoginRoute(u?: Pick<SessionUser, "role" | "business">) {
  const role = String(u?.role || "").toUpperCase();

  if (role === "STAFF") return "/business/dashboard/staff";
  if (["ADMIN", "SUPER_ADMIN", "CREATOR"].includes(role)) return "/admin";

  if (role === "BUSINESS_OWNER") {
    // If we DON'T know the business yet, be optimistic and let the dashboard gate handle it.
    if (!u?.business) return "/business/dashboard";

    const status = pickStatus(u.business);
    return isApproved(status) ? "/business/dashboard" : "/business/onboarding/pending";
  }

  return "/(tabs)"; // customers
}

// ---------------------------------------------------------------------------

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { setAuth, token, user, ready } = useSession();

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; phone?: string; password?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const redirectingRef = useRef(false);

  // If user lands on login while already authenticated, route them.
  useEffect(() => {
    if (!ready || !token || !user || redirectingRef.current) return;

    redirectingRef.current = true;
    console.log("🔄 Already authenticated, redirecting from login...", { role: user.role });
    router.replace(getPostLoginRoute(user));
    // No need to reset redirectingRef since we're leaving this screen
  }, [ready, token, user, router]);

  const validateForm = () => {
    const newErrors: { email?: string; phone?: string; password?: string } = {};
    if (!email.trim() && !phone.trim()) {
      newErrors.email = "Email or phone is required";
      newErrors.phone = "Email or phone is required";
    }
    if (email.trim() && !/\S+@\S+\.\S+/.test(email.trim())) newErrors.email = "Please enter a valid email";
    if (phone.trim() && !/^\+?[\d\s\-\(\)]{7,}$/.test(phone.trim())) newErrors.phone = "Please enter a valid phone number";
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
        password: password || "",
      };

      console.log("🔐 Attempting login...");
      const res = await login(payload);
      if (res?.error) {
        setServerError(res.error || "Invalid credentials. Please try again.");
        return;
      }

      // Get user data - the updated /api/users/me now includes business data
      const userData = res?.user ?? (await meHeartbeat());
      let normalizedUser: SessionUser = {
        id: userData?.id,
        email: userData?.email,
        role: userData?.role,
        business: userData?.business, // This now comes with proper verification status
      };

      console.log("✅ Login successful:", { 
        role: normalizedUser.role, 
        hasBusiness: !!normalizedUser.business,
        verificationStatus: normalizedUser.business?.verificationStatus 
      });

      if (res?.token) {
        await setAuth(res.token, normalizedUser);
        router.replace(getPostLoginRoute(normalizedUser));
      }
    } catch (e: any) {
      console.error("❌ Login error:", e);
      setServerError(e?.response?.data?.error || e?.message || "Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => router.push("../forgot-password");
  const handleCreateAccount = () => router.push("/auth/signup");
  const handleBack = () => router.back();

  if (ready && token && user) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <IconButton icon="arrow-left" size={24} iconColor={theme.colors.onBackground} onPress={handleBack} style={styles.backButton} />
            <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onBackground }]}>Sign In</Text>
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
              {errors.email ? <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>{errors.email}</Text> : null}

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
              {errors.phone ? <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>{errors.phone}</Text> : null}

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
              {errors.password ? <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>{errors.password}</Text> : null}

              {serverError ? <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>{serverError}</Text> : null}

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