"use client";

import { useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Text, TextInput, Button, useTheme, Surface, IconButton, HelperText } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useOnboarding } from "../../../context/OnboardingContext";

export default function OwnerDetails() {
  const theme = useTheme();
  const router = useRouter();
  const { data, setData, updateKycSection } = useOnboarding();

  // Form state with validation
  const [formData, setFormData] = useState({
    name: data.ownerName || "",
    phone: data.ownerPhone || "",
    email: data.ownerEmail || "",
    idNumber: data.idNumber || "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = "Full name is required";
    } else if (formData.name.trim().length < 2) {
      newErrors.name = "Name must be at least 2 characters";
    }

    // Phone validation
    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
    } else if (!/^[+]?[\d\s-()]{10,15}$/.test(formData.phone.trim())) {
      newErrors.phone = "Please enter a valid phone number";
    }

    // ID Number validation
    if (!formData.idNumber.trim()) {
      newErrors.idNumber = "National ID/Passport number is required";
    } else if (formData.idNumber.trim().length < 6) {
      newErrors.idNumber = "ID number must be at least 6 characters";
    }

    // Email validation (optional but must be valid if provided)
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = "Please enter a valid email address";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ""
      }));
    }
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    
    try {
      // Save data to onboarding context
      setData({
        ownerName: formData.name.trim(),
        ownerPhone: formData.phone.trim(),
        ownerEmail: formData.email.trim(),
        idNumber: formData.idNumber.trim(),
      });

      // ✅ FIX: Mark owner section complete when form is filled (photos will be handled separately)
      // This allows progression to live capture step where photos are taken
      const isFormComplete = !!(
        formData.name.trim() && 
        formData.phone.trim() && 
        formData.idNumber.trim()
      );
      
      console.log('Owner form validation:', {
        hasName: !!formData.name.trim(),
        hasPhone: !!formData.phone.trim(),
        hasIdNumber: !!formData.idNumber.trim(),
        isFormComplete,
        businessVerificationType: data.businessVerificationType
      });

      // Mark section complete based on form completion (photos handled in addAttachment)
      updateKycSection("owner", isFormComplete);

      // Navigate back with a small delay for better UX
      setTimeout(() => {
        router.back();
      }, 300);

    } catch (error) {
      console.error("Error saving owner details:", error);
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = () => {
    return formData.name.trim() && 
           formData.phone.trim() && 
           formData.idNumber.trim() &&
           Object.keys(errors).length === 0;
  };

  // ✅ Helper to show photo status in UI
  const getPhotoStatus = () => {
    const requiresSelfie = (data.businessVerificationType || "INFORMAL") === "FORMAL";
    const hasIdFront = !!(data.sections?.owner?.idFrontUrl || data.idPhotoUrl);
    const hasSelfie = requiresSelfie 
      ? !!(data.sections?.owner?.selfieUrl || data.selfieWithIdUrl) 
      : true;

    if (requiresSelfie) {
      return {
        text: hasIdFront && hasSelfie 
          ? "✅ ID photo and selfie captured" 
          : hasIdFront 
            ? "⚠️ ID photo captured, selfie needed" 
            : "❌ ID photo and selfie required",
        color: hasIdFront && hasSelfie 
          ? theme.colors.primary 
          : hasIdFront 
            ? "#FF9800" 
            : theme.colors.error
      };
    } else {
      return {
        text: hasIdFront 
          ? "✅ ID photo captured" 
          : "❌ ID photo required",
        color: hasIdFront ? theme.colors.primary : theme.colors.error
      };
    }
  };

  const photoStatus = getPhotoStatus();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <IconButton 
            icon="arrow-left" 
            size={22} 
            iconColor={theme.colors.primary}
            onPress={() => router.back()} 
          />
          <View style={styles.headerContent}>
            <View style={[styles.stepIndicator, { backgroundColor: theme.colors.primary }]}>
              <Text style={[styles.stepNumber, { color: theme.colors.onPrimary }]}>👤</Text>
            </View>
            <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onBackground }]}>
              Owner / CEO Details
            </Text>
          </View>
        </View>

        {/* Main Form Card */}
        <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <View style={styles.formHeader}>
            <Text variant="titleLarge" style={[styles.formTitle, { color: theme.colors.primary }]}>
              Personal Information
            </Text>
            <Text variant="bodyMedium" style={[styles.formSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              Please provide the owner or CEO details for verification
            </Text>
          </View>

          <View style={styles.divider} />

          {/* ✅ Photo Status Indicator - Informational Only */}
          <View style={[styles.statusContainer, { backgroundColor: `${photoStatus.color}15` }]}>
            <Text variant="bodyMedium" style={[styles.statusText, { color: photoStatus.color }]}>
              {photoStatus.text}
            </Text>
            <Text variant="bodySmall" style={[styles.statusSubtext, { color: theme.colors.onSurfaceVariant }]}>
              Photos will be captured in the next step (Live Capture)
            </Text>
          </View>

          {/* Form Fields */}
          <View style={styles.formFields}>
            {/* Full Name */}
            <View style={styles.inputContainer}>
              <TextInput
                mode="outlined"
                label="Full Name *"
                value={formData.name}
                onChangeText={(value) => handleInputChange('name', value)}
                style={[styles.input, { backgroundColor: theme.colors.surface }]}
                error={!!errors.name}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
              />
              {errors.name && (
                <HelperText type="error" visible={!!errors.name}>
                  {errors.name}
                </HelperText>
              )}
            </View>

            {/* Phone Number */}
            <View style={styles.inputContainer}>
              <TextInput
                mode="outlined"
                label="Phone Number *"
                value={formData.phone}
                onChangeText={(value) => handleInputChange('phone', value)}
                style={[styles.input, { backgroundColor: theme.colors.surface }]}
                error={!!errors.phone}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                placeholder="+254 700 000 000"
              />
              {errors.phone && (
                <HelperText type="error" visible={!!errors.phone}>
                  {errors.phone}
                </HelperText>
              )}
            </View>

            {/* National ID/Passport */}
            <View style={styles.inputContainer}>
              <TextInput
                mode="outlined"
                label="National ID / Passport Number *"
                value={formData.idNumber}
                onChangeText={(value) => handleInputChange('idNumber', value)}
                style={[styles.input, { backgroundColor: theme.colors.surface }]}
                error={!!errors.idNumber}
                autoCapitalize="characters"
                placeholder="12345678 or AB123456"
              />
              {errors.idNumber && (
                <HelperText type="error" visible={!!errors.idNumber}>
                  {errors.idNumber}
                </HelperText>
              )}
            </View>

            {/* Email (Optional) */}
            <View style={styles.inputContainer}>
              <TextInput
                mode="outlined"
                label="Official Email (Optional)"
                value={formData.email}
                onChangeText={(value) => handleInputChange('email', value)}
                style={[styles.input, { backgroundColor: theme.colors.surface }]}
                error={!!errors.email}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                placeholder="owner@company.com"
              />
              {errors.email && (
                <HelperText type="error" visible={!!errors.email}>
                  {errors.email}
                </HelperText>
              )}
              {!errors.email && formData.email.trim() && (
                <HelperText type="info">
                  This email will be used for important business communications
                </HelperText>
              )}
            </View>
          </View>

          {/* Required Fields Note */}
          <View style={styles.requiredNote}>
            <Text variant="bodySmall" style={[styles.requiredText, { color: theme.colors.onSurfaceVariant }]}>
              * Required fields
            </Text>
          </View>

          {/* Save Button */}
          <Button
            mode="contained"
            onPress={handleSave}
            loading={loading}
            disabled={loading || !isFormValid()}
            style={[
              styles.saveButton,
              {
                backgroundColor: isFormValid() ? "#FBC02D" : theme.colors.surfaceDisabled,
                opacity: isFormValid() ? 1 : 0.6
              }
            ]}
            contentStyle={styles.buttonContent}
            labelStyle={[
              styles.buttonLabel,
              { color: isFormValid() ? theme.colors.primary : theme.colors.onSurfaceDisabled }
            ]}
          >
            {loading ? "Saving..." : "Save & Continue"}
          </Button>

          {/* Helper Text */}
          <Text variant="bodySmall" style={[styles.helperText, { color: theme.colors.onSurfaceVariant }]}>
            This information will be used for business verification and compliance purposes
          </Text>
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  scrollContent: { 
    flexGrow: 1, 
    padding: 20 
  },
  header: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginBottom: 24 
  },
  headerContent: {
    flex: 1,
    alignItems: "center",
    marginLeft: -40 // Offset for back button
  },
  stepIndicator: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    justifyContent: "center", 
    alignItems: "center", 
    marginBottom: 8 
  },
  stepNumber: { 
    fontSize: 20
  },
  title: { 
    fontWeight: "700", 
    textAlign: "center" 
  },
  card: { 
    borderRadius: 20, 
    padding: 24 
  },
  formHeader: {
    alignItems: "center",
    marginBottom: 20
  },
  formTitle: {
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center"
  },
  formSubtitle: {
    textAlign: "center",
    lineHeight: 20
  },
  divider: {
    height: 2,
    backgroundColor: "#1559C1",
    marginBottom: 20,
    borderRadius: 1
  },
  // ✅ New photo status styles
  statusContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: "center"
  },
  statusText: {
    fontWeight: "600",
    marginBottom: 4,
    textAlign: "center"
  },
  statusSubtext: {
    textAlign: "center",
    fontSize: 12
  },
  formFields: {
    gap: 4
  },
  inputContainer: {
    marginBottom: 16
  },
  input: {
    backgroundColor: "transparent"
  },
  requiredNote: {
    marginBottom: 20
  },
  requiredText: {
    fontStyle: "italic",
    fontSize: 12
  },
  saveButton: {
    borderRadius: 26,
    marginBottom: 16
  },
  buttonContent: {
    paddingVertical: 8
  },
  buttonLabel: {
    fontWeight: "700",
    fontSize: 16
  },
  helperText: {
    textAlign: "center",
    fontStyle: "italic",
    lineHeight: 18,
    fontSize: 12
  },
});