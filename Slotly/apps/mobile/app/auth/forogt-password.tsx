import React, { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { Text, TextInput, Button, Surface, IconButton, useTheme } from "react-native-paper";
import { useRouter } from "expo-router";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setError(null);
    const ok = /\S+@\S+\.\S+/.test(email.trim());
    if (!ok) return setError("Enter a valid email");

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not send reset email");
      setSent(true);
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={2}>
        <View style={styles.header}>
          <IconButton icon="arrow-left" onPress={() => router.back()} />
          <Text variant="headlineSmall">Forgot password</Text>
        </View>

        {sent ? (
          <Text style={styles.info}>
            If an account exists for <Text style={{ fontWeight: "600" }}>{email}</Text>, we sent a reset link.
          </Text>
        ) : (
          <>
            <TextInput
              mode="outlined"
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              error={!!error}
              left={<TextInput.Icon icon="email" />}
              style={styles.input}
            />
            {error ? <Text style={{ color: theme.colors.error, marginLeft: 12 }}>{error}</Text> : null}

            <Button
              mode="contained"
              onPress={submit}
              loading={loading}
              disabled={loading}
              style={styles.button}
            >
              Send reset link
            </Button>
          </>
        )}

        <Button mode="text" onPress={() => router.replace("/auth/login")} style={{ alignSelf: "center", marginTop: 8 }}>
          Back to sign in
        </Button>
      </Surface>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  card: { margin: 16, borderRadius: 16, padding: 16, flex: 1 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  input: { marginTop: 8, marginBottom: 8 },
  button: { marginTop: 12, borderRadius: 28 },
  info: { margin: 16 },
});
