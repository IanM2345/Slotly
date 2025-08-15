import React, { useState } from 'react';
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
  HelperText
} from 'react-native-paper';
import { useRouter } from 'expo-router';

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

export default function AccountDetailsScreen() {
  const theme = useTheme();
  const router = useRouter();
  
  const [formData, setFormData] = useState<FormData>({
    fullName: 'John Doe',
    email: 'john.doe@email.com',
    phoneNumber: '+254712345678',
    dateOfBirth: '1990-01-15'
  });
  
  const [serviceType, setServiceType] = useState<string>('everyone');
  const [loading, setLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [snackbarVisible, setSnackbarVisible] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  const [snackbarType, setSnackbarType] = useState<'success' | 'error'>('success');

  const handleBack = () => {
    router.back();
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhoneNumber = (phone: string): boolean => {
    // Basic validation for international phone numbers
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
  };

  const validateDate = (date: string): boolean => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) return false;
    
    const parsedDate = new Date(date);
    const today = new Date();
    const minAge = new Date(today.getFullYear() - 13, today.getMonth(), today.getDate());
    
    return parsedDate <= minAge && parsedDate >= new Date('1900-01-01');
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Full name validation
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = 'Full name must be at least 2 characters';
    }

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Phone number validation
    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    } else if (!validatePhoneNumber(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Please enter a valid phone number (e.g., +254712345678)';
    }

    // Date of birth validation
    if (!formData.dateOfBirth.trim()) {
      newErrors.dateOfBirth = 'Date of birth is required';
    } else if (!validateDate(formData.dateOfBirth)) {
      newErrors.dateOfBirth = 'Please enter a valid date (YYYY-MM-DD) and must be at least 13 years old';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveChanges = async (): Promise<void> => {
    if (!validateForm()) {
      setSnackbarMessage('Please fix the errors before saving');
      setSnackbarType('error');
      setSnackbarVisible(true);
      return;
    }

    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Here you would make your actual API call
      console.log('Saving account details:', { ...formData, serviceType });
      
      setSnackbarMessage('Account details saved successfully!');
      setSnackbarType('success');
      setSnackbarVisible(true);
      
      // Navigate back after a short delay to show success message
      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (error) {
      console.error('Error saving account details:', error);
      setSnackbarMessage('Failed to save account details. Please try again.');
      setSnackbarType('error');
      setSnackbarVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (field: keyof FormData, value: string): void => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const formatPhoneNumber = (phone: string): string => {
    // Remove all non-digit characters except +
    let formatted = phone.replace(/[^\d+]/g, '');
    
    // Ensure it starts with +
    if (!formatted.startsWith('+')) {
      formatted = '+' + formatted;
    }
    
    return formatted;
  };

  const handlePhoneChange = (text: string): void => {
    const formatted = formatPhoneNumber(text);
    updateFormData('phoneNumber', formatted);
  };

  const formatDateInput = (text: string): string => {
    // Remove all non-digit characters
    const digits = text.replace(/\D/g, '');
    
    // Format as YYYY-MM-DD
    if (digits.length >= 8) {
      return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
    } else if (digits.length >= 6) {
      return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
    } else if (digits.length >= 4) {
      return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    }
    return digits;
  };

  const handleDateChange = (text: string): void => {
    const formatted = formatDateInput(text);
    updateFormData('dateOfBirth', formatted);
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
        />
        <Text style={styles.headerTitle}>Account Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Personal Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Details</Text>
          
          <View style={styles.formContainer}>
            <View>
              <TextInput
                mode="outlined"
                label="Full Name"
                value={formData.fullName}
                onChangeText={(text) => updateFormData('fullName', text)}
                style={styles.textInput}
                outlineColor={errors.fullName ? '#ff6b6b' : '#333'}
                activeOutlineColor={errors.fullName ? '#ff6b6b' : '#333'}
                textColor="#333"
                autoCapitalize="words"
                error={!!errors.fullName}
              />
              <HelperText type="error" visible={!!errors.fullName}>
                {errors.fullName}
              </HelperText>
            </View>

            <View>
              <TextInput
                mode="outlined"
                label="Email"
                value={formData.email}
                onChangeText={(text) => updateFormData('email', text.toLowerCase())}
                style={styles.textInput}
                outlineColor={errors.email ? '#ff6b6b' : '#333'}
                activeOutlineColor={errors.email ? '#ff6b6b' : '#333'}
                textColor="#333"
                keyboardType="email-address"
                autoCapitalize="none"
                error={!!errors.email}
              />
              <HelperText type="error" visible={!!errors.email}>
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
                outlineColor={errors.phoneNumber ? '#ff6b6b' : '#333'}
                activeOutlineColor={errors.phoneNumber ? '#ff6b6b' : '#333'}
                textColor="#333"
                keyboardType="phone-pad"
                placeholder="+254712345678"
                error={!!errors.phoneNumber}
              />
              <HelperText type="error" visible={!!errors.phoneNumber}>
                {errors.phoneNumber}
              </HelperText>
            </View>

            <View>
              <TextInput
                mode="outlined"
                label="Date of Birth"
                value={formData.dateOfBirth}
                onChangeText={handleDateChange}
                style={styles.textInput}
                outlineColor={errors.dateOfBirth ? '#ff6b6b' : '#333'}
                activeOutlineColor={errors.dateOfBirth ? '#ff6b6b' : '#333'}
                textColor="#333"
                placeholder="YYYY-MM-DD"
                keyboardType="numeric"
                maxLength={10}
                error={!!errors.dateOfBirth}
              />
              <HelperText type="error" visible={!!errors.dateOfBirth}>
                {errors.dateOfBirth}
              </HelperText>
            </View>
          </View>
        </View>

        {/* Service Type Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Type</Text>
          <Text style={styles.sectionSubtitle}>Choose who can book your services</Text>
          
          <View style={styles.serviceTypeContainer}>
            <SegmentedButtons
              value={serviceType}
              onValueChange={setServiceType}
              buttons={[
                {
                  value: 'women',
                  label: 'Women Only',
                  style: styles.segmentButton
                },
                {
                  value: 'men',
                  label: 'Men Only',
                  style: styles.segmentButton
                },
                {
                  value: 'everyone',
                  label: 'Everyone',
                  style: styles.segmentButton
                }
              ]}
              style={styles.segmentedButtons}
            />
          </View>
        </View>

        {/* Save Button */}
        <View style={styles.saveButtonContainer}>
          <Button
            mode="contained"
            onPress={handleSaveChanges}
            loading={loading}
            disabled={loading}
            style={styles.saveButton}
            labelStyle={styles.saveButtonText}
            contentStyle={styles.saveButtonContent}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </View>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Snackbar for feedback */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={[
          styles.snackbar,
          snackbarType === 'error' ? styles.errorSnackbar : styles.successSnackbar
        ]}
      >
        {snackbarMessage}
      </Snackbar>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffc0cb', // Light pink background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 48, // Same width as IconButton to center title
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  formContainer: {
    gap: 4, // Reduced gap since HelperText adds spacing
  },
  textInput: {
    backgroundColor: 'rgba(255, 192, 203, 0.7)',
  },
  serviceTypeContainer: {
    marginTop: 8,
  },
  segmentedButtons: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#333',
  },
  segmentButton: {
    borderColor: '#333',
  },
  saveButtonContainer: {
    marginTop: 40,
    marginBottom: 24,
  },
  saveButton: {
    backgroundColor: '#ff69b4',
    borderRadius: 25,
  },
  saveButtonContent: {
    paddingVertical: 12,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  bottomSpacing: {
    height: 32,
  },
  snackbar: {
    marginBottom: 20,
  },
  successSnackbar: {
    backgroundColor: '#4caf50',
  },
  errorSnackbar: {
    backgroundColor: '#f44336',
  },
});