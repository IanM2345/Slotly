"use client"

import type { RelativePathString } from "expo-router";

import { useState } from "react"
import { ScrollView, View, StyleSheet } from "react-native"
import { Text, Surface, TextInput, Button, useTheme, HelperText, IconButton } from "react-native-paper"
import { useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { useToast } from "./_layout"
import { staffApi } from "../../../../lib/staff/api"
import type { StaffRegistration } from "../../../../lib/staff/types"

export default function StaffRegisterScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { notify } = useToast()

  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<StaffRegistration>({
    businessId: "",
    fullName: "",
    address: "",
    email: "",
    phone: "",
    nationalId: "",
    nationalIdPhoto: null,
    selfiePhoto: null,
  })

  const [errors, setErrors] = useState<Partial<Record<keyof StaffRegistration, string>>>({})

  const validateForm = () => {
    const newErrors: Partial<Record<keyof StaffRegistration, string>> = {}

    if (!formData.businessId.trim()) newErrors.businessId = "Business ID is required"
    if (!formData.fullName.trim()) newErrors.fullName = "Full name is required"
    if (!formData.address.trim()) newErrors.address = "Address is required"
    if (!formData.email.trim()) newErrors.email = "Email is required"
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = "Invalid email format"
    if (!formData.phone.trim()) newErrors.phone = "Phone is required"
    else if (!/^\+?[\d\s-()]+$/.test(formData.phone)) newErrors.phone = "Invalid phone format"
    if (!formData.nationalId.trim()) newErrors.nationalId = "National ID is required"

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    setLoading(true)
    try {
      const result = await staffApi.registerStaff(formData)
      notify(result.message)
      router.replace("profile" as RelativePathString)
    } catch (error) {
      notify("Registration failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handlePhotoUpload = (type: "nationalIdPhoto" | "selfiePhoto") => {
    // Simulate photo selection
    setFormData((prev) => ({
      ...prev,
      [type]: `mock-${type}-uri-${Date.now()}`,
    }))
  }

  const isFormValid = validateForm() && Object.keys(errors).length === 0

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Surface style={[styles.headerCard, { backgroundColor: theme.colors.primary }]} elevation={2}>
          <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onPrimary }]}>
            Slotly — Staff Registration Portal
          </Text>
          <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onPrimary }]}>
            Step 1 of 1 – Complete Your Registration
          </Text>
        </Surface>

        {/* Form */}
        <Surface style={styles.formCard} elevation={1}>
          <View style={styles.formContent}>
            <TextInput
              label="Business ID"
              value={formData.businessId}
              onChangeText={(text) => setFormData((prev) => ({ ...prev, businessId: text }))}
              mode="outlined"
              style={styles.input}
              error={!!errors.businessId}
            />
            <HelperText type="error" visible={!!errors.businessId}>
              {errors.businessId}
            </HelperText>

            <TextInput
              label="Full Name"
              value={formData.fullName}
              onChangeText={(text) => setFormData((prev) => ({ ...prev, fullName: text }))}
              mode="outlined"
              style={styles.input}
              error={!!errors.fullName}
            />
            <HelperText type="error" visible={!!errors.fullName}>
              {errors.fullName}
            </HelperText>

            <TextInput
              label="Address"
              value={formData.address}
              onChangeText={(text) => setFormData((prev) => ({ ...prev, address: text }))}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.input}
              error={!!errors.address}
            />
            <HelperText type="error" visible={!!errors.address}>
              {errors.address}
            </HelperText>

            <TextInput
              label="Email"
              value={formData.email}
              onChangeText={(text) => setFormData((prev) => ({ ...prev, email: text }))}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              error={!!errors.email}
            />
            <HelperText type="error" visible={!!errors.email}>
              {errors.email}
            </HelperText>

            <TextInput
              label="Phone"
              value={formData.phone}
              onChangeText={(text) => setFormData((prev) => ({ ...prev, phone: text }))}
              mode="outlined"
              keyboardType="phone-pad"
              style={styles.input}
              error={!!errors.phone}
            />
            <HelperText type="error" visible={!!errors.phone}>
              {errors.phone}
            </HelperText>

            <TextInput
              label="National ID"
              value={formData.nationalId}
              onChangeText={(text) => setFormData((prev) => ({ ...prev, nationalId: text }))}
              mode="outlined"
              style={styles.input}
              error={!!errors.nationalId}
            />
            <HelperText type="error" visible={!!errors.nationalId}>
              {errors.nationalId}
            </HelperText>

            {/* Photo Upload Zones */}
            <Surface
              style={[
                styles.uploadZone,
                { borderColor: theme.colors.outline },
                formData.nationalIdPhoto && { backgroundColor: theme.colors.primaryContainer },
              ]}
              onTouchEnd={() => handlePhotoUpload("nationalIdPhoto")}
            >
              <IconButton
                icon={formData.nationalIdPhoto ? "check-circle" : "camera"}
                size={32}
                iconColor={formData.nationalIdPhoto ? theme.colors.primary : theme.colors.onSurfaceVariant}
              />
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: "center" }}>
                {formData.nationalIdPhoto
                  ? "✅ National ID Photo Selected"
                  : "Click to upload National ID Photo\n(Max 5MB)"}
              </Text>
            </Surface>

            <Surface
              style={[
                styles.uploadZone,
                { borderColor: theme.colors.outline },
                formData.selfiePhoto && { backgroundColor: theme.colors.primaryContainer },
              ]}
              onTouchEnd={() => handlePhotoUpload("selfiePhoto")}
            >
              <IconButton
                icon={formData.selfiePhoto ? "check-circle" : "camera"}
                size={32}
                iconColor={formData.selfiePhoto ? theme.colors.primary : theme.colors.onSurfaceVariant}
              />
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: "center" }}>
                {formData.selfiePhoto ? "✅ Selfie Photo Selected" : "Click to upload Selfie Photo\n(Max 5MB)"}
              </Text>
            </Surface>

            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={loading}
              disabled={loading || !isFormValid}
              style={[styles.submitButton, { backgroundColor: "#FBC02D" }]}
              labelStyle={{ color: theme.colors.onPrimary }}
              contentStyle={styles.buttonContent}
            >
              Submit Registration
            </Button>
          </View>
        </Surface>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  headerCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
  },
  title: {
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    opacity: 0.9,
  },
  formCard: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
  },
  formContent: {
    padding: 24,
  },
  input: {
    marginBottom: 4,
  },
  uploadZone: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    marginVertical: 16,
  },
  submitButton: {
    borderRadius: 25,
    marginTop: 24,
  },
  buttonContent: {
    paddingVertical: 8,
  },
})
