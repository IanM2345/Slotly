"use client"

import { useState } from "react"
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from "react-native"
import { Text, TextInput, Button, useTheme, Surface, IconButton, Checkbox } from "react-native-paper"
import { useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { signupInitiate } from "../../lib/api/modules/auth"
import { storage } from "../../lib/utilis/storage"

export default function SignupScreen() {
  const theme = useTheme()
  const router = useRouter()
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
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
  const [serverError, setServerError] = useState<string | null>(null)

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }))
    if (serverError) setServerError(null)
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.firstName.trim()) newErrors.firstName = "First name is required"
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required"

    if (!formData.email.trim()) newErrors.email = "Email is required"
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = "Please enter a valid email"

    if (!formData.phone.trim()) newErrors.phone = "Phone number is required"
    else if (!/^\+?[\d\s-()]+$/.test(formData.phone)) newErrors.phone = "Please enter a valid phone number"

    if (!formData.password.trim()) newErrors.password = "Password is required"
    else if (formData.password.length < 8) newErrors.password = "Password must be at least 8 characters"

    if (!formData.confirmPassword.trim()) newErrors.confirmPassword = "Please confirm your password"
    else if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Passwords do not match"

    if (!acceptedTerms) newErrors.terms = "You must accept the Terms & Privacy Policy"

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleContinue = async () => {
    if (!validateForm()) return
    setLoading(true)
    setServerError(null)
    
    try {
      const { firstName, lastName, email, phone, password } = formData
      
      // Prepare the full name as expected by the API
      const fullName = `${firstName.trim()} ${lastName.trim()}`
      
      const res = await signupInitiate({
        firstName,
        lastName,
        email: email.trim(),
        phone: phone.trim(),
        password,
      })

      if (res?.error) {
        setServerError(res.error || "Signup failed. Please try again.")
        return
      }

      // Store all necessary data for OTP verification
      const signupData = {
        email: email.trim(),
        password: password, // Store the actual password for OTP verification
        name: fullName, // Store full name as expected by verify endpoint
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        sessionData: res?.sessionData, // Store any session data from the response
        userId: res?.userId, // Store userId if provided
        timestamp: Date.now(), // Add timestamp for expiry checking
      }

      // Save all signup data for the OTP screen
      await storage.setJSON("signupData", signupData)

      // Also save sessionData separately if it exists (for backward compatibility)
      if (res?.sessionData) {
        await storage.setJSON("signupSessionData", res.sessionData)
      }

      // Navigate to OTP screen with email and userId
      const params: Record<string, string> = { 
        email: email.trim(),
        flow: "signup" // Add flow parameter to distinguish signup from other flows
      }
      
      if (res?.userId) {
        params.userId = String(res.userId)
      }

      console.log("Navigating to OTP with params:", params)
      router.push({ pathname: "/auth/otp", params })
      
    } catch (e: any) {
      console.error("Signup error:", e)
      setServerError(e?.response?.data?.error || e?.message || "Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleSocialLogin = (provider: "google" | "facebook" | "apple") => {
    console.log(`Login with ${provider}`)
    // TODO: Implement social login
  }

  const handleSignIn = () => router.push("../auth/login")
  const handleBack = () => router.back()

  const isFormValid =
    acceptedTerms && 
    Object.values(formData).every((v) => String(v).trim() !== "") &&
    formData.password === formData.confirmPassword &&
    formData.password.length >= 8 &&
    /\S+@\S+\.\S+/.test(formData.email) &&
    /^\+?[\d\s-()]+$/.test(formData.phone)

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
            <View style={styles.logoContainer}>
              <Text style={[styles.logoText, { color: "#004AAD" }]}>SLOTLY</Text>
            </View>
            <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onBackground }]}>
              Create Your Account
            </Text>
          </View>

          {/* Social Login Options */}
          <View style={styles.socialContainer}>
            <TouchableOpacity
              style={[styles.socialButton, { borderColor: theme.colors.outline }]}
              onPress={() => handleSocialLogin("google")}
            >
              <Text style={styles.socialButtonText}>Continue with Google</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.socialButton, { borderColor: theme.colors.outline, backgroundColor: "#1877F2" }]}
              onPress={() => handleSocialLogin("facebook")}
            >
              <Text style={[styles.socialButtonText, { color: "#FFFFFF" }]}>Continue with Facebook</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.socialButton, { borderColor: theme.colors.outline, backgroundColor: "#000000" }]}
              onPress={() => handleSocialLogin("apple")}
            >
              <Text style={[styles.socialButtonText, { color: "#FFFFFF" }]}>Continue with Apple</Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={[styles.dividerLine, { backgroundColor: theme.colors.outline }]} />
            <Text style={[styles.dividerText, { color: theme.colors.onSurfaceVariant }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.colors.outline }]} />
          </View>

          {/* Form */}
          <Surface style={[styles.formContainer, { backgroundColor: theme.colors.surface }]} elevation={2}>
            <View style={styles.form}>
              <View style={styles.nameRow}>
                <View style={styles.nameField}>
                  <TextInput
                    mode="outlined"
                    label="First Name"
                    value={formData.firstName}
                    onChangeText={(t) => updateField("firstName", t)}
                    autoCapitalize="words"
                    autoComplete="given-name"
                    error={!!errors.firstName}
                    style={styles.input}
                    left={<TextInput.Icon icon="account" />}
                  />
                  {errors.firstName ? (
                    <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                      {errors.firstName}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.nameField}>
                  <TextInput
                    mode="outlined"
                    label="Last Name"
                    value={formData.lastName}
                    onChangeText={(t) => updateField("lastName", t)}
                    autoCapitalize="words"
                    autoComplete="family-name"
                    error={!!errors.lastName}
                    style={styles.input}
                    left={<TextInput.Icon icon="account" />}
                  />
                  {errors.lastName ? (
                    <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                      {errors.lastName}
                    </Text>
                  ) : null}
                </View>
              </View>

              <TextInput
                mode="outlined"
                label="Email Address"
                value={formData.email}
                onChangeText={(t) => updateField("email", t)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                error={!!errors.email}
                style={styles.input}
                left={<TextInput.Icon icon="email" />}
              />
              {errors.email ? (
                <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                  {errors.email}
                </Text>
              ) : null}

              <TextInput
                mode="outlined"
                label="Phone Number"
                value={formData.phone}
                onChangeText={(t) => updateField("phone", t)}
                keyboardType="phone-pad"
                autoComplete="tel"
                error={!!errors.phone}
                style={styles.input}
                left={<TextInput.Icon icon="phone" />}
              />
              {errors.phone ? (
                <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                  {errors.phone}
                </Text>
              ) : null}

              <TextInput
                mode="outlined"
                label="Password"
                value={formData.password}
                onChangeText={(t) => updateField("password", t)}
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
              {errors.password ? (
                <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                  {errors.password}
                </Text>
              ) : null}

              <TextInput
                mode="outlined"
                label="Confirm Password"
                value={formData.confirmPassword}
                onChangeText={(t) => updateField("confirmPassword", t)}
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
              {errors.confirmPassword ? (
                <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                  {errors.confirmPassword}
                </Text>
              ) : null}

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
              {errors.terms ? (
                <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                  {errors.terms}
                </Text>
              ) : null}

              {serverError ? (
                <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                  {serverError}
                </Text>
              ) : null}

              <Button
                mode="contained"
                onPress={handleContinue}
                loading={loading}
                disabled={loading || !isFormValid}
                style={[
                  styles.continueButton,
                  { backgroundColor: isFormValid ? "#004AAD" : theme.colors.surfaceDisabled, opacity: isFormValid ? 1 : 0.6 },
                ]}
                contentStyle={styles.buttonContent}
                labelStyle={styles.buttonLabel}
              >
                Create Account
              </Button>
            </View>
          </Surface>

          {/* Footer */}
          <View style={styles.footer}>
            <Text variant="bodyMedium" style={[styles.footerText, { color: theme.colors.onSurfaceVariant }]}>
              Already have an account?{" "}
              <Text style={[styles.linkText, { color: "#004AAD" }]} onPress={handleSignIn}>
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
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 24,
  },
  backButton: {
    position: 'absolute',
    left: -8,
    top: 16,
    zIndex: 1,
  },
  logoContainer: {
    marginBottom: 16,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    fontFamily: 'Impact',
    letterSpacing: 2,
  },
  title: {
    fontWeight: "bold",
    textAlign: 'center',
  },
  socialContainer: {
    marginBottom: 24,
    gap: 12,
  },
  socialButton: {
    borderWidth: 1,
    borderRadius: 28,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
  },
  formContainer: {
    borderRadius: 16,
    marginBottom: 32,
  },
  form: {
    padding: 24,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  nameField: {
    flex: 1,
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