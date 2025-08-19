"use client"

import { useState } from "react"
import { View, ScrollView, StyleSheet } from "react-native"
import { Text, TextInput, Button, Surface, useTheme } from "react-native-paper"
import { SafeAreaView } from "react-native-safe-area-context"
import { useOnboarding } from "../../../context/OnboardingContext" // keep your working path
import { useSession } from "../../../context/SessionContext"

export default function BusinessInformation() {
  const theme = useTheme()
  const { updateBusiness } = useSession()
  const { setData, goNext } = useOnboarding()

  const [formData, setFormData] = useState({
    businessName: "",
    businessType: "",
    email: "",
    phone: "",
    address: "",
  })

  const [loading, setLoading] = useState(false)

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleNext = async () => {
    setLoading(true)
    await new Promise((r) => setTimeout(r, 1000))

    // Keep your existing session state in sync
    updateBusiness({
      businessName: formData.businessName,
      businessType: formData.businessType,
    })

    // Store onboarding data & advance via centralized flow
    setData({
      businessName: formData.businessName,
      businessType: formData.businessType,
    })

    setLoading(false)
    goNext("step1") // → plan screen
  }

  const isFormValid = () => Object.values(formData).every((v) => v.trim() !== "")

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.stepIndicator, { backgroundColor: theme.colors.primary }]}>
            <Text style={[styles.stepNumber, { color: theme.colors.onPrimary }]}>1</Text>
          </View>
          <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onBackground }]}>
            Step 1: Business Information
          </Text>
        </View>

        {/* Phone Status Bar Mockup */}
        <View style={[styles.phoneBar, { backgroundColor: theme.colors.primary }]}>
          <Text style={[styles.timeText, { color: theme.colors.onPrimary }]}>9:41 AM</Text>
        </View>

        {/* Main Content */}
        <Surface style={[styles.formContainer, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <View style={styles.formHeader}>
            <View style={styles.menuIcon}>
              <View style={[styles.menuLine, { backgroundColor: theme.colors.primary }]} />
              <View style={[styles.menuLine, { backgroundColor: theme.colors.primary }]} />
              <View style={[styles.menuLine, { backgroundColor: theme.colors.primary }]} />
            </View>
            <Text variant="titleLarge" style={[styles.formTitle, { color: theme.colors.primary }]}>
              Business Registration
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.formFields}>
            <View style={styles.fieldGroup}>
              <Text variant="titleMedium" style={[styles.fieldLabel, { color: theme.colors.primary }]}>
                Business Name
              </Text>
              <TextInput
                mode="outlined"
                placeholder="e.g., Nairobi Hair Studio"
                value={formData.businessName}
                onChangeText={(value) => handleInputChange("businessName", value)}
                style={styles.input}
                outlineColor={theme.colors.outline}
                activeOutlineColor={theme.colors.primary}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text variant="titleMedium" style={[styles.fieldLabel, { color: theme.colors.primary }]}>
                Business Type
              </Text>
              <TextInput
                mode="outlined"
                placeholder="e.g., Salon, Law Firm, College"
                value={formData.businessType}
                onChangeText={(value) => handleInputChange("businessType", value)}
                style={styles.input}
                outlineColor={theme.colors.outline}
                activeOutlineColor={theme.colors.primary}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text variant="titleMedium" style={[styles.fieldLabel, { color: theme.colors.primary }]}>
                Email
              </Text>
              <TextInput
                mode="outlined"
                placeholder="business@example.com"
                value={formData.email}
                onChangeText={(value) => handleInputChange("email", value)}
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                outlineColor={theme.colors.outline}
                activeOutlineColor={theme.colors.primary}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text variant="titleMedium" style={[styles.fieldLabel, { color: theme.colors.primary }]}>
                Phone
              </Text>
              <TextInput
                mode="outlined"
                placeholder="+254 700 000 000"
                value={formData.phone}
                onChangeText={(value) => handleInputChange("phone", value)}
                style={styles.input}
                keyboardType="phone-pad"
                outlineColor={theme.colors.outline}
                activeOutlineColor={theme.colors.primary}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text variant="titleMedium" style={[styles.fieldLabel, { color: theme.colors.primary }]}>
                Address
              </Text>
              <TextInput
                mode="outlined"
                placeholder="Westlands, Nairobi"
                value={formData.address}
                onChangeText={(value) => handleInputChange("address", value)}
                style={styles.input}
                multiline
                numberOfLines={2}
                outlineColor={theme.colors.outline}
                activeOutlineColor={theme.colors.primary}
              />
            </View>
          </View>

          <Button
            mode="contained"
            onPress={handleNext}
            loading={loading}
            disabled={loading || !isFormValid()}
            style={[
              styles.nextButton,
              { backgroundColor: isFormValid() ? "#FBC02D" : theme.colors.surfaceDisabled },
            ]}
            contentStyle={styles.buttonContent}
            labelStyle={[styles.buttonLabel, { color: theme.colors.primary }]}
          >
            Next: Choose Plan
          </Button>
        </Surface>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 20 },
  header: { alignItems: "center", marginBottom: 20 },
  stepIndicator: {
    width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", marginBottom: 12,
  },
  stepNumber: { fontSize: 18, fontWeight: "bold" },
  title: { fontWeight: "bold", textAlign: "center" },
  phoneBar: { height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", marginBottom: 20 },
  timeText: { fontSize: 16, fontWeight: "600" },
  formContainer: { borderRadius: 20, padding: 24, marginBottom: 20 },
  formHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  menuIcon: { marginRight: 12 },
  menuLine: { width: 20, height: 3, marginBottom: 3, borderRadius: 1.5 },
  formTitle: { fontWeight: "bold" },
  divider: { height: 2, backgroundColor: "#1559C1", marginBottom: 24 },
  formFields: { marginBottom: 32 },
  fieldGroup: { marginBottom: 20 },
  fieldLabel: { fontWeight: "600", marginBottom: 8 },
  input: { backgroundColor: "transparent" },
  nextButton: { borderRadius: 25, marginTop: 16 },
  buttonContent: { paddingVertical: 8 },
  buttonLabel: { fontSize: 16, fontWeight: "600" },
})
