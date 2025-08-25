import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Surface,
  IconButton,
  SegmentedButtons,
  useTheme,
  Snackbar,
  HelperText,
  ActivityIndicator,
} from 'react-native-paper';
import { useRouter } from 'expo-router';

import { useSession } from '../../context/SessionContext';
import { getMe, updateMe } from '../../lib/api/modules/users';

interface FormData {
  fullName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: string;
}

interface FormErrors {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
}

type SnackType = 'success' | 'error';

export default function AccountDetailsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { token } = useSession();

  const [serviceType, setServiceType] = useState<string>('everyone');
  const [loading, setLoading] = useState<boolean>(false);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [errors, setErrors] = useState<FormErrors>({});
  const [snackbarVisible, setSnackbarVisible] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  const [snackbarType, setSnackbarType] = useState<SnackType>('success');

  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    phoneNumber: '',
    dateOfBirth: '',
  });

  // Keep a copy to compare changes before saving
  const [initialProfile, setInitialProfile] = useState<{ name?: string; email?: string; phone?: string } | null>(null);

  const handleBack = () => router.back();

  // -------- Validation helpers --------
  const validateEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  
  const validatePhoneNumber = (phone: string): boolean => /^\+[1-9]\d{1,14}$/.test(phone);
  
  const validateDate = (date: string): boolean => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) return false;
    
    const parsedDate = new Date(date);
    const today = new Date();
    const minAge = new Date(today.getFullYear() - 13, today.getMonth(), today.getDate());
    
    return parsedDate <= minAge && parsedDate >= new Date('1900-01-01');
  };

  const updateFormData = (field: keyof FormData, value: string): void => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const formatPhoneNumber = (phone: string): string => {
    let formatted = phone.replace(/[^\d+]/g, '');
    if (!formatted.startsWith('+')) formatted = '+' + formatted;
    return formatted;
  };

  const handlePhoneChange = (text: string) => updateFormData('phoneNumber', formatPhoneNumber(text));

  const formatDateInput = (text: string): string => {
    const digits = text.replace(/\D/g, '');
    if (digits.length >= 8) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
    if (digits.length >= 6) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
    if (digits.length >= 4) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return digits;
  };

  const handleDateChange = (text: string) => updateFormData('dateOfBirth', formatDateInput(text));

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = 'Full name must be at least 2 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    } else if (!validatePhoneNumber(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Use E.164 format (e.g., +254712345678)';
    }

    if (formData.dateOfBirth && !validateDate(formData.dateOfBirth)) {
      newErrors.dateOfBirth = 'Use YYYY-MM-DD and at least 13 years old';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // -------- Load current user from API --------
  const loadProfile = useCallback(async () => {
    if (!token) {
      // If no token, use fallback data for development/testing
      setFormData({
        fullName: 'John Doe',
        email: 'john.doe@email.com',
        phoneNumber: '+254712345678',
        dateOfBirth: '1990-01-15'
      });
      setInitialLoading(false);
      return;
    }

    try {
      setInitialLoading(true);
      const me = await getMe(token); // { id, email, name, phone, role, createdAt }
      setInitialProfile({ name: me?.name, email: me?.email, phone: me?.phone });

      setFormData({
        fullName: me?.name || '',
        email: me?.email || '',
        phoneNumber: me?.phone || '',
        dateOfBirth: '', // no server field yet
      });
    } catch (e) {
      console.error('Failed to load profile:', e);
      setSnackbarMessage('Failed to load account details.');
      setSnackbarType('error');
      setSnackbarVisible(true);
      
      // Fallback to demo data on error
      setFormData({
        fullName: 'John Doe',
        email: 'john.doe@email.com',
        phoneNumber: '+254712345678',
        dateOfBirth: '1990-01-15'
      });
    } finally {
      setInitialLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // -------- Save changes --------
  const handleSaveChanges = async (): Promise<void> => {
    if (!validateForm()) {
      setSnackbarMessage('Please fix the errors before saving');
      setSnackbarType('error');
      setSnackbarVisible(true);
      return;
    }

    setLoading(true);
    try {
      if (token && initialProfile) {
        // Real API call - only send changed fields your API accepts: { name?, phone?, password? }
        const payload: { name?: string; phone?: string } = {};
        if (initialProfile?.name !== formData.fullName) payload.name = formData.fullName.trim();
        if (initialProfile?.phone !== formData.phoneNumber) payload.phone = formData.phoneNumber.trim();

        if (!payload.name && !payload.phone) {
          setSnackbarMessage('Nothing to update.');
          setSnackbarType('success');
          setSnackbarVisible(true);
          setLoading(false);
          return;
        }

        await updateMe(payload, token);
        // Refresh initial cache so subsequent edits diff correctly
        setInitialProfile(prev => ({ 
          ...(prev || {}), 
          name: formData.fullName, 
          phone: formData.phoneNumber 
        }));
      } else {
        // Demo/development mode - simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));
        console.log('Demo mode - saving account details:', { ...formData, serviceType });
      }
      
      setSnackbarMessage('Account details saved successfully!');
      setSnackbarType('success');
      setSnackbarVisible(true);
      
      setTimeout(() => router.back(), 1500);
    } catch (error) {
      console.error('Error saving account details:', error);
      setSnackbarMessage('Failed to save account details. Please try again.');
      setSnackbarType('error');
      setSnackbarVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const snackBg = snackbarType === 'error' ? theme.colors.error : theme.colors.primary;

  if (initialLoading) {
    return (
      <Surface style={[styles.container, { backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 16, color: theme.colors.onSurfaceVariant, fontSize: 16 }}>Loading account details...</Text>
      </Surface>
    );
  }

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton icon="arrow-left" size={24} iconColor={theme.colors.onSurface} onPress={handleBack} />
        <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>Account Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Personal Details Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Personal Details</Text>

          <View style={styles.formContainer}>
            <View>
              <TextInput
                mode="outlined"
                label="Full Name"
                value={formData.fullName}
                onChangeText={(text) => updateFormData('fullName', text)}
                style={styles.textInput}
                outlineColor={errors.fullName ? theme.colors.error : theme.colors.outline}
                activeOutlineColor={errors.fullName ? theme.colors.error : theme.colors.primary}
                textColor={theme.colors.onSurface}
                autoCapitalize="words"
                error={!!errors.fullName}
              />
              <HelperText type="error" visible={!!errors.fullName}>{errors.fullName}</HelperText>
            </View>

            <View>
              <TextInput
                mode="outlined"
                label="Email"
                value={formData.email}
                onChangeText={(text) => token && initialProfile ? {} : updateFormData('email', text.toLowerCase())}
                style={styles.textInput}
                outlineColor={errors.email ? theme.colors.error : theme.colors.outline}
                activeOutlineColor={errors.email ? theme.colors.error : (token && initialProfile ? theme.colors.outline : theme.colors.primary)}
                textColor={theme.colors.onSurface}
                keyboardType="email-address"
                autoCapitalize="none"
                disabled={!!(token && initialProfile)}
                error={!!errors.email}
              />
              <HelperText type="info" visible={!!(token && initialProfile)}>
                Email changes are managed separately.
              </HelperText>
              <HelperText type="error" visible={!!errors.email && !(token && initialProfile)}>
                {errors.email}
              </HelperText>
            </View>

            <View>
              <TextInput
                mode="outlined"
                label="Phone Number"
                value={formData.phoneNumber}
                onChangeText={handlePhoneChange}
                style={styles.textInput}
                outlineColor={errors.phoneNumber ? theme.colors.error : theme.colors.outline}
                activeOutlineColor={errors.phoneNumber ? theme.colors.error : theme.colors.primary}
                textColor={theme.colors.onSurface}
                keyboardType="phone-pad"
                placeholder="+254712345678"
                error={!!errors.phoneNumber}
              />
              <HelperText type="error" visible={!!errors.phoneNumber}>{errors.phoneNumber}</HelperText>
            </View>

            <View>
              <TextInput
                mode="outlined"
                label="Date of Birth"
                value={formData.dateOfBirth}
                onChangeText={handleDateChange}
                style={styles.textInput}
                outlineColor={errors.dateOfBirth ? theme.colors.error : theme.colors.outline}
                activeOutlineColor={errors.dateOfBirth ? theme.colors.error : theme.colors.primary}
                textColor={theme.colors.onSurface}
                placeholder="YYYY-MM-DD"
                keyboardType="numeric"
                maxLength={10}
                error={!!errors.dateOfBirth}
              />
              <HelperText type="info" visible={!!(token && initialProfile)}>
                Not synced to server yet.
              </HelperText>
              <HelperText type="error" visible={!!errors.dateOfBirth}>{errors.dateOfBirth}</HelperText>
            </View>
          </View>
        </View>

        {/* Service Type Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Service Type</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>Choose who can book your services</Text>

          <View style={styles.serviceTypeContainer}>
            <SegmentedButtons
              value={serviceType}
              onValueChange={setServiceType}
              buttons={[
                { value: 'women', label: 'Women Only', style: styles.segmentButton },
                { value: 'men', label: 'Men Only', style: styles.segmentButton },
                { value: 'everyone', label: 'Everyone', style: styles.segmentButton },
              ]}
              style={[styles.segmentedButtons, { backgroundColor: theme.colors.surfaceVariant }]}
            />
          </View>
          {token && initialProfile && (
            <HelperText type="info" visible style={{ marginTop: 8 }}>
              Service type preferences coming soon.
            </HelperText>
          )}
        </View>

        {/* Save Button */}
        <View style={styles.saveButtonContainer}>
          <Button
            mode="contained"
            onPress={handleSaveChanges}
            loading={loading}
            disabled={loading}
            style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
            labelStyle={[styles.saveButtonText, { color: theme.colors.onPrimary }]}
            contentStyle={styles.saveButtonContent}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Snackbar */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={[styles.snackbar, { backgroundColor: snackBg }]}
      >
        {snackbarMessage}
      </Snackbar>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8 },
  headerTitle: { flex: 1, fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
  headerSpacer: { width: 48 },
  scrollView: { flex: 1, paddingHorizontal: 16 },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  sectionSubtitle: { fontSize: 14, marginBottom: 16 },
  formContainer: { gap: 4 },
  textInput: { backgroundColor: 'transparent' },
  serviceTypeContainer: { marginTop: 8 },
  segmentedButtons: { borderRadius: 25, borderWidth: 1 },
  segmentButton: { borderColor: 'transparent' },
  saveButtonContainer: { marginTop: 40, marginBottom: 24 },
  saveButton: { borderRadius: 25 },
  saveButtonContent: { paddingVertical: 12 },
  saveButtonText: { fontSize: 18, fontWeight: 'bold' },
  bottomSpacing: { height: 32 },
  snackbar: { marginBottom: 20 },
});