import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import {
  Text,
  Surface,
  IconButton,
  TextInput,
  Button,
  useTheme
} from 'react-native-paper';
import { useRouter } from 'expo-router';

interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function ChangePasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [passwordData, setPasswordData] = useState<PasswordData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState<Partial<PasswordData>>({});

  const handleBack = () => {
    router.back();
  };

  const updatePasswordData = (field: keyof PasswordData, value: string) => {
    setPasswordData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<PasswordData> = {};

    if (!passwordData.currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }

    if (!passwordData.newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (passwordData.newPassword.length < 6) {
      newErrors.newPassword = 'Password must be at least 6 characters';
    }

    if (!passwordData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your new password';
    } else if (passwordData.newPassword !== passwordData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdatePassword = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('Updating password...');
      
      // Navigate back or show success message
      router.back();
    } catch (error) {
      console.error('Error updating password:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Surface style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          iconColor="#333"
          onPress={handleBack}
          style={styles.backButton}
        />
        <Text style={styles.headerTitle}>Change Password</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.formContainer}>
          {/* Current Password */}
          <TextInput
            mode="outlined"
            label="Current Password"
            value={passwordData.currentPassword}
            onChangeText={(text) => updatePasswordData('currentPassword', text)}
            style={styles.textInput}
            outlineColor="#333"
            activeOutlineColor="#333"
            textColor="#333"
            secureTextEntry
            error={!!errors.currentPassword}
          />
          {errors.currentPassword && (
            <Text style={styles.errorText}>{errors.currentPassword}</Text>
          )}

          {/* New Password */}
          <TextInput
            mode="outlined"
            label="New Password"
            value={passwordData.newPassword}
            onChangeText={(text) => updatePasswordData('newPassword', text)}
            style={styles.textInput}
            outlineColor="#333"
            activeOutlineColor="#333"
            textColor="#333"
            secureTextEntry
            error={!!errors.newPassword}
          />
          {errors.newPassword && (
            <Text style={styles.errorText}>{errors.newPassword}</Text>
          )}

          {/* Confirm New Password */}
          <TextInput
            mode="outlined"
            label="Confirm New Password"
            value={passwordData.confirmPassword}
            onChangeText={(text) => updatePasswordData('confirmPassword', text)}
            style={styles.textInput}
            outlineColor="#333"
            activeOutlineColor="#333"
            textColor="#333"
            secureTextEntry
            error={!!errors.confirmPassword}
          />
          {errors.confirmPassword && (
            <Text style={styles.errorText}>{errors.confirmPassword}</Text>
          )}
        </View>

        {/* Update Button */}
        <View style={styles.updateButtonContainer}>
          <Button
            mode="contained"
            onPress={handleUpdatePassword}
            loading={loading}
            disabled={loading}
            style={styles.updateButton}
            labelStyle={styles.updateButtonText}
            contentStyle={styles.updateButtonContent}
          >
            Update Password
          </Button>
        </View>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffc0cb', // Slotly pink background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 16,
    paddingBottom: 16,
  },
  backButton: {
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
    marginRight: 48, // Compensate for back button width
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  formContainer: {
    paddingTop: 24,
    gap: 20,
    marginBottom: 40,
  },
  textInput: {
    backgroundColor: 'rgba(255, 192, 203, 0.7)',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 12,
    marginTop: -16,
    marginBottom: 4,
    marginLeft: 12,
  },
  updateButtonContainer: {
    marginBottom: 24,
  },
  updateButton: {
    backgroundColor: '#333',
    borderRadius: 25,
  },
  updateButtonContent: {
    paddingVertical: 12,
  },
  updateButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  bottomSpacing: {
    height: 32,
  },
});
