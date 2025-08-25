import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Surface, Text, TextInput, Button, useTheme, Snackbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { requestPasswordReset } from '../../lib/api/modules/auth';

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState<{ visible: boolean; msg: string }>({ visible: false, msg: '' });

  const onSubmit = async () => {
    if (!email.trim()) {
      setSnack({ visible: true, msg: 'Please enter your email' });
      return;
    }
    setLoading(true);
    try {
      const res = await requestPasswordReset(email.trim().toLowerCase());
      setSnack({ visible: true, msg: 'If the email exists, a reset link was sent.' });

      // DEV convenience: if backend returns devToken, jump to reset screen
      if (res?.devToken) {
        router.push({ pathname: '/reset-password', params: { token: res.devToken } } as any);
      }
    } catch (e: any) {
      setSnack({ visible: true, msg: 'Failed to request reset' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text variant="headlineMedium" style={{ fontWeight: 'bold', marginBottom: 8 }}>
          Forgot Password
        </Text>
        <Text style={{ color: theme.colors.onSurfaceVariant, marginBottom: 20 }}>
          Enter the email you used to sign up. We'll send a reset link or code.
        </Text>

        <TextInput
          mode="outlined"
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />

        <Button mode="contained" onPress={onSubmit} loading={loading} disabled={loading} style={styles.button}>
          Send Reset
        </Button>

        <View style={{ height: 20 }} />
        <Button onPress={() => router.back()} mode="text">Back to Login</Button>
      </ScrollView>

      <Snackbar visible={snack.visible} onDismiss={() => setSnack({ visible: false, msg: '' })} duration={2200}>
        {snack.msg}
      </Snackbar>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: 16, paddingTop: 48 },
  input: { backgroundColor: 'transparent', marginBottom: 16 },
  button: { borderRadius: 10, paddingVertical: 6 },
});