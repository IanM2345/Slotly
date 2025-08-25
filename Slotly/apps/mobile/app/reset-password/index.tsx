import React, { useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Surface, Text, TextInput, Button, useTheme, Snackbar } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { confirmPasswordReset } from '../../lib/api/modules/auth';

export default function ResetPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const initialToken = useMemo(() => String(params?.token ?? ''), [params?.token]);

  const [token, setToken] = useState(initialToken);
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState<{ visible: boolean; msg: string }>({ visible: false, msg: '' });

  const onSubmit = async () => {
    if (!token.trim()) return setSnack({ visible: true, msg: 'Reset token is required' });
    if (!pw1 || pw1.length < 6) return setSnack({ visible: true, msg: 'Password must be at least 6 characters' });
    if (pw1 !== pw2) return setSnack({ visible: true, msg: 'Passwords do not match' });

    setLoading(true);
    try {
      await confirmPasswordReset({ token: token.trim(), newPassword: pw1 });
      setSnack({ visible: true, msg: 'Password updated. You can log in now.' });
      setTimeout(() => router.replace('/login' as any), 900);
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Failed to reset password';
      setSnack({ visible: true, msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text variant="headlineMedium" style={{ fontWeight: 'bold', marginBottom: 8 }}>
          Reset Password
        </Text>
        <Text style={{ color: theme.colors.onSurfaceVariant, marginBottom: 20 }}>
          Paste the code from your email, then choose a new password.
        </Text>

        <TextInput mode="outlined" label="Reset Token" value={token} onChangeText={setToken} style={styles.input} />
        <TextInput mode="outlined" label="New Password" value={pw1} onChangeText={setPw1} secureTextEntry style={styles.input} />
        <TextInput mode="outlined" label="Confirm Password" value={pw2} onChangeText={setPw2} secureTextEntry style={styles.input} />

        <Button mode="contained" onPress={onSubmit} loading={loading} disabled={loading} style={styles.button}>
          Save New Password
        </Button>

        <View style={{ height: 20 }} />
        <Button onPress={() => router.back()} mode="text">Back</Button>
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