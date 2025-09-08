// apps/mobile/app/settings/change-password.tsx
import React, { useState, useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import {
  Text, Surface, IconButton, TextInput, Button, useTheme, Snackbar
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSession } from '../../context/SessionContext';
import { changePassword } from '../../lib/api/modules/users';

interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function ChangePasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { token } = useSession();

  const [loading, setLoading] = useState(false);
  const [passwordData, setPasswordData] = useState<PasswordData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Partial<PasswordData>>({});
  const [snack, setSnack] = useState<{ visible: boolean; msg: string }>({ visible: false, msg: '' });
  
  // Password visibility states
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const canSubmit = useMemo(() => {
    const { currentPassword, newPassword, confirmPassword } = passwordData;
    return (
      !!currentPassword &&
      !!newPassword &&
      newPassword.length >= 6 &&
      newPassword === confirmPassword &&
      currentPassword !== newPassword &&
      !loading
    );
  }, [passwordData, loading]);

  const handleBack = () => {
    // Always navigate to edit-profile specifically
    router.push('/edit-profile');
  };

  const updatePasswordData = (field: keyof PasswordData, value: string) => {
    setPasswordData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const validateForm = (): boolean => {
    const e: Partial<PasswordData> = {};
    if (!passwordData.currentPassword) e.currentPassword = 'Current password is required';
    if (!passwordData.newPassword) e.newPassword = 'New password is required';
    else if (passwordData.newPassword.length < 6) e.newPassword = 'Password must be at least 6 characters';
    if (!passwordData.confirmPassword) e.confirmPassword = 'Please confirm your new password';
    else if (passwordData.newPassword !== passwordData.confirmPassword) e.confirmPassword = 'Passwords do not match';
    if (passwordData.currentPassword && passwordData.newPassword && passwordData.currentPassword === passwordData.newPassword) {
      e.newPassword = 'New password must be different from current';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleUpdatePassword = async () => {
    if (!token) {
      setSnack({ visible: true, msg: 'You must be logged in' });
      return;
    }
    if (!validateForm()) return;

    setLoading(true);
    try {
      await changePassword(
        { currentPassword: passwordData.currentPassword, newPassword: passwordData.newPassword },
        token
      );
      setSnack({ visible: true, msg: 'Password updated' });
      // Navigate to edit-profile after success
      setTimeout(() => router.push('/edit-profile'), 900);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to update password';
      // surface server-side specific errors
      if (/incorrect current password/i.test(msg)) {
        setErrors(prev => ({ ...prev, currentPassword: 'Incorrect current password' }));
      } else if (/at least 6/i.test(msg)) {
        setErrors(prev => ({ ...prev, newPassword: 'Password must be at least 6 characters' }));
      }
      setSnack({ visible: true, msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <IconButton 
          icon="arrow-left" 
          size={24} 
          iconColor={theme.colors.onSurface} 
          onPress={handleBack} 
          style={styles.backButton} 
        />
        <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>Change Password</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.formContainer}>
          <TextInput
            mode="outlined"
            label="Current Password"
            value={passwordData.currentPassword}
            onChangeText={(t) => updatePasswordData('currentPassword', t)}
            style={styles.textInput}
            outlineColor={theme.colors.outline}
            activeOutlineColor={theme.colors.primary}
            textColor={theme.colors.onSurface}
            secureTextEntry={!showCurrentPassword}
            error={!!errors.currentPassword}
            right={
              <TextInput.Icon 
                icon={showCurrentPassword ? "eye-off" : "eye"} 
                onPress={() => setShowCurrentPassword(!showCurrentPassword)} 
              />
            }
          />
          {!!errors.currentPassword && <Text style={styles.errorText}>{errors.currentPassword}</Text>}

          <TextInput
            mode="outlined"
            label="New Password"
            value={passwordData.newPassword}
            onChangeText={(t) => updatePasswordData('newPassword', t)}
            style={styles.textInput}
            outlineColor={theme.colors.outline}
            activeOutlineColor={theme.colors.primary}
            textColor={theme.colors.onSurface}
            secureTextEntry={!showNewPassword}
            error={!!errors.newPassword}
            right={
              <TextInput.Icon 
                icon={showNewPassword ? "eye-off" : "eye"} 
                onPress={() => setShowNewPassword(!showNewPassword)} 
              />
            }
          />
          {!!errors.newPassword && <Text style={styles.errorText}>{errors.newPassword}</Text>}

          <TextInput
            mode="outlined"
            label="Confirm New Password"
            value={passwordData.confirmPassword}
            onChangeText={(t) => updatePasswordData('confirmPassword', t)}
            style={styles.textInput}
            outlineColor={theme.colors.outline}
            activeOutlineColor={theme.colors.primary}
            textColor={theme.colors.onSurface}
            secureTextEntry={!showConfirmPassword}
            error={!!errors.confirmPassword}
            right={
              <TextInput.Icon 
                icon={showConfirmPassword ? "eye-off" : "eye"} 
                onPress={() => setShowConfirmPassword(!showConfirmPassword)} 
              />
            }
          />
          {!!errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
        </View>

        <View style={styles.updateButtonContainer}>
          <Button
            mode="contained"
            onPress={handleUpdatePassword}
            loading={loading}
            disabled={!canSubmit}
            style={styles.updateButton}
            labelStyle={styles.updateButtonText}
            contentStyle={styles.updateButtonContent}
          >
            Update Password
          </Button>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      <Snackbar visible={snack.visible} onDismiss={() => setSnack({ visible: false, msg: '' })} duration={2200}>
        {snack.msg}
      </Snackbar>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: 16, paddingBottom: 16 },
  backButton: { marginRight: 8 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', flex: 1, textAlign: 'center', marginRight: 48 },
  scrollView: { flex: 1, paddingHorizontal: 16 },
  formContainer: { paddingTop: 24, gap: 20, marginBottom: 40 },
  textInput: { backgroundColor: 'transparent' },
  errorText: { color: '#d32f2f', fontSize: 12, marginTop: -16, marginBottom: 4, marginLeft: 12 },
  updateButtonContainer: { marginBottom: 24 },
  updateButton: { borderRadius: 25 },
  updateButtonContent: { paddingVertical: 12 },
  updateButtonText: { fontSize: 18, fontWeight: 'bold' },
  bottomSpacing: { height: 32 },
});