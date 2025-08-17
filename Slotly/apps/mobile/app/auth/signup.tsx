"use client"

import { useState } from "react"
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from "react-native"
import { Text, TextInput, Button, useTheme, Surface, IconButton, Checkbox } from "react-native-paper"
import { useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"

export default function SignupScreen() {
  const theme = useTheme()
  const router = useRouter()
  const [formData, setFormData] = useState({
    businessName: "",
    ownerName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.businessName.trim()) {
      newErrors.businessName = "Business name is required"
    }

    if (!formData.ownerName.trim()) {
      newErrors.ownerName = "Owner name is required"
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required"
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email"
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required"
    } else if (!/^\+?[\d\s-()]+$/.test(formData.phone)) {
      newErrors.phone = "Please enter a valid phone number"
    }

    if (!formData.password.trim()) {
      newErrors.password = "Password is required"
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters"
    }

    if (!formData.confirmPassword.trim()) {
      newErrors.confirmPassword = "Please confirm your password"
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match"
    }

    if (!acceptedTerms) {
      newErrors.terms = "You must accept the Terms & Privacy Policy"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleContinue = async () => {
    if (!validateForm()) return

    setLoading(true)
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Navigate to OTP verification - use formData.email instead of just email
      router.push(`/auth/otp?email=${encodeURIComponent(formData.email)}`) 
    } catch (error) {
      console.error("Signup error:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSignIn = () => {
    // Fixed the path - use /auth/login instead of ../auth/login
    router.push("../auth/login") 
  }

  const handleBack = () => {
    router.back()
  }

  const isFormValid = acceptedTerms && Object.values(formData).every((value) => value.trim() !== "")

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <IconButton
              icon="arrow-left"
              size={24}
              iconColor={theme.colors.onBackground}
              onPress={handleBack}
              style={styles.backButton}
            />
            <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onBackground }]}>
              Create Account
            </Text>
          </View>

          {/* Form */}
          <Surface style={[styles.formContainer, { backgroundColor: theme.colors.surface }]} elevation={2}>
            <View style={styles.form}>
              <TextInput
                mode="outlined"
                label="Business Name"
                value={formData.businessName}
                onChangeText={(text) => updateField("businessName", text)}
                autoCapitalize="words"
                error={!!errors.businessName}
                style={styles.input}
                left={<TextInput.Icon icon="store" />}
              />
              {errors.businessName && (
                <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                  {errors.businessName}
                </Text>
              )}

              <TextInput
                mode="outlined"
                label="Owner Name"
                value={formData.ownerName}
                onChangeText={(text) => updateField("ownerName", text)}
                autoCapitalize="words"
                autoComplete="name"
                error={!!errors.ownerName}
                style={styles.input}
                left={<TextInput.Icon icon="account" />}
              />
              {errors.ownerName && (
                <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                  {errors.ownerName}
                </Text>
              )}

              <TextInput
                mode="outlined"
                label="Email Address"
                value={formData.email}
                onChangeText={(text) => updateField("email", text)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                error={!!errors.email}
                style={styles.input}
                left={<TextInput.Icon icon="email" />}
              />
              {errors.email && (
                <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                  {errors.email}
                </Text>
              )}

              <TextInput
                mode="outlined"
                label="Phone Number"
                value={formData.phone}
                onChangeText={(text) => updateField("phone", text)}
                keyboardType="phone-pad"
                autoComplete="tel"
                error={!!errors.phone}
                style={styles.input}
                left={<TextInput.Icon icon="phone" />}
              />
              {errors.phone && (
                <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                  {errors.phone}
                </Text>
              )}

              <TextInput
                mode="outlined"
                label="Password"
                value={formData.password}
                onChangeText={(text) => updateField("password", text)}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                error={!!errors.password}
                style={styles.input}
                left={<TextInput.Icon icon="lock" />}
                right={
                  <TextInput.Icon
                    icon={showPassword ? "eye-off" : "eye"}
                    onPress={() => setShowPassword(!showPassword)}
                  />
                }
              />
              {errors.password && (
                <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                  {errors.password}
                </Text>
              )}

              <TextInput
                mode="outlined"
                label="Confirm Password"
                value={formData.confirmPassword}
                onChangeText={(text) => updateField("confirmPassword", text)}
                secureTextEntry={!showConfirmPassword}
                autoComplete="new-password"
                error={!!errors.confirmPassword}
                style={styles.input}
                left={<TextInput.Icon icon="lock-check" />}
                right={
                  <TextInput.Icon
                    icon={showConfirmPassword ? "eye-off" : "eye"}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  />
                }
              />
              {errors.confirmPassword && (
                <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                  {errors.confirmPassword}
                </Text>
              )}

              {/* Terms & Privacy Checkbox */}
              <View style={styles.checkboxContainer}>
                <Checkbox
                  status={acceptedTerms ? "checked" : "unchecked"}
                  onPress={() => setAcceptedTerms(!acceptedTerms)}
                  color={theme.colors.primary}
                />
                <Text
                  variant="bodyMedium"
                  style={[styles.checkboxText, { color: theme.colors.onSurfaceVariant }]}
                  onPress={() => setAcceptedTerms(!acceptedTerms)}
                >
                  I agree to the{" "}
                  <Text style={[styles.linkText, { color: theme.colors.primary }]}>Terms of Service</Text> and{" "}
                  <Text style={[styles.linkText, { color: theme.colors.primary }]}>Privacy Policy</Text>
                </Text>
              </View>
              {errors.terms && (
                <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                  {errors.terms}
                </Text>
              )}

              <Button
                mode="contained"
                onPress={handleContinue}
                loading={loading}
                disabled={loading || !isFormValid}
                style={[
                  styles.continueButton,
                  {
                    backgroundColor: isFormValid ? theme.colors.primary : theme.colors.surfaceDisabled,
                    opacity: isFormValid ? 1 : 0.6,
                  },
                ]}
                contentStyle={styles.buttonContent}
                labelStyle={styles.buttonLabel}
              >
                Continue
              </Button>
            </View>
          </Surface>

          {/* Footer */}
          <View style={styles.footer}>
            <Text variant="bodyMedium" style={[styles.footerText, { color: theme.colors.onSurfaceVariant }]}>
              Already have an account?{" "}
              <Text style={[styles.linkText, { color: theme.colors.primary }]} onPress={handleSignIn}>
                Sign In
              </Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 32,
  },
  backButton: {
    marginLeft: -8,
    marginRight: 8,
  },
  title: {
    fontWeight: "bold",
  },
  formContainer: {
    borderRadius: 16,
    marginBottom: 32,
  },
  form: {
    padding: 24,
  },
  input: {
    marginBottom: 8,
  },
  errorText: {
    marginBottom: 16,
    marginLeft: 12,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 24,
    paddingRight: 16,
  },
  checkboxText: {
    flex: 1,
    marginLeft: 8,
    lineHeight: 20,
  },
  linkText: {
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  continueButton: {
    borderRadius: 28,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    alignItems: "center",
    paddingBottom: 32,
  },
  footerText: {
    textAlign: "center",
  },
})