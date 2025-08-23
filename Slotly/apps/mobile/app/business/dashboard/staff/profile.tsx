"use client"

import { useState, useEffect } from "react"
import { ScrollView, View, StyleSheet } from "react-native"
import { Text, Surface, TextInput, Button, useTheme, Avatar, IconButton, HelperText } from "react-native-paper"
import { useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { useToast } from "./_layout"
import { staffApi } from "../../../../lib/staff/api"
import type { StaffProfile, PasswordChange } from "../../../../lib/staff/types"

export default function StaffProfileScreen() {
  const theme = useTheme()
  const router = useRouter()
  const { notify } = useToast()

  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<StaffProfile>({
    id: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    avatarUri: undefined,
  })

  const [passwordData, setPasswordData] = useState<PasswordChange>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  const [passwordErrors, setPasswordErrors] = useState<Partial<Record<keyof PasswordChange, string>>>({})

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const profileData = await staffApi.getProfile()
      setProfile(profileData)
    } catch (error) {
      notify("Failed to load profile")
    }
  }

  const handleUploadPhoto = () => {
    // Simulate photo upload
    setProfile((prev) => ({
      ...prev,
      avatarUri: `mock-avatar-uri-${Date.now()}`,
    }))
  }

  const validatePassword = () => {
    const errors: Partial<Record<keyof PasswordChange, string>> = {}

    if (passwordData.newPassword && passwordData.newPassword !== passwordData.confirmPassword) {
      errors.confirmPassword = "Passwords do not match"
    }

    setPasswordErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSaveChanges = async () => {
    if (!validatePassword()) return

    setLoading(true)
    try {
      await staffApi.updateProfile(profile)

      if (passwordData.currentPassword && passwordData.newPassword) {
        await staffApi.changePassword(passwordData)
      }

      notify("Profile updated successfully")
    } catch (error) {
      notify("Failed to update profile")
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    router.back()
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <IconButton icon="menu" size={24} iconColor={theme.colors.onBackground} style={styles.menuButton} />
          <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onBackground }]}>
            Profile Settings
          </Text>
        </View>

        <Surface style={styles.profileCard} elevation={1}>
          <View style={styles.profileContent}>
            {/* Avatar Section */}
            <View style={styles.avatarSection}>
              <Avatar.Icon
                size={80}
                icon="account"
                style={[styles.avatar, { backgroundColor: theme.colors.surfaceVariant }]}
              />
              <Button
                mode="contained"
                onPress={handleUploadPhoto}
                style={[styles.uploadButton, { backgroundColor: theme.colors.primary }]}
                labelStyle={{ color: theme.colors.onPrimary }}
              >
                Upload Photo
              </Button>
            </View>

            {/* Profile Form */}
            <TextInput
              label="First Name"
              value={profile.firstName}
              onChangeText={(text) => setProfile((prev) => ({ ...prev, firstName: text }))}
              mode="outlined"
              style={styles.input}
            />

            <TextInput
              label="Last Name"
              value={profile.lastName}
              onChangeText={(text) => setProfile((prev) => ({ ...prev, lastName: text }))}
              mode="outlined"
              style={styles.input}
            />

            <TextInput
              label="Email"
              value={profile.email}
              onChangeText={(text) => setProfile((prev) => ({ ...prev, email: text }))}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />

            <TextInput
              label="Phone"
              value={profile.phone}
              onChangeText={(text) => setProfile((prev) => ({ ...prev, phone: text }))}
              mode="outlined"
              keyboardType="phone-pad"
              style={styles.input}
            />

            {/* Change Password Section */}
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
              Change Password
            </Text>

            <TextInput
              label="Current Password"
              value={passwordData.currentPassword}
              onChangeText={(text) => setPasswordData((prev) => ({ ...prev, currentPassword: text }))}
              mode="outlined"
              secureTextEntry
              style={styles.input}
            />

            <TextInput
              label="New Password"
              value={passwordData.newPassword}
              onChangeText={(text) => setPasswordData((prev) => ({ ...prev, newPassword: text }))}
              mode="outlined"
              secureTextEntry
              style={styles.input}
            />

            <TextInput
              label="Confirm New Password"
              value={passwordData.confirmPassword}
              onChangeText={(text) => setPasswordData((prev) => ({ ...prev, confirmPassword: text }))}
              mode="outlined"
              secureTextEntry
              style={styles.input}
              error={!!passwordErrors.confirmPassword}
            />
            <HelperText type="error" visible={!!passwordErrors.confirmPassword}>
              {passwordErrors.confirmPassword}
            </HelperText>

            {/* Action Buttons */}
            <View style={styles.buttonRow}>
              <Button
                mode="contained"
                onPress={handleSaveChanges}
                loading={loading}
                disabled={loading}
                style={[styles.saveButton, { backgroundColor: "#FBC02D" }]}
                labelStyle={{ color: theme.colors.onPrimary }}
                contentStyle={styles.buttonContent}
              >
                Save Changes
              </Button>

              <Button
                mode="outlined"
                onPress={handleCancel}
                style={[styles.cancelButton, { borderColor: theme.colors.outline }]}
                labelStyle={{ color: theme.colors.onSurface }}
                contentStyle={styles.buttonContent}
              >
                Cancel
              </Button>
            </View>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  menuButton: {
    marginRight: 8,
  },
  title: {
    fontWeight: "700",
  },
  profileCard: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
  },
  profileContent: {
    padding: 24,
  },
  avatarSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 32,
  },
  avatar: {
    marginRight: 16,
  },
  uploadButton: {
    borderRadius: 20,
  },
  input: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: "600",
    marginTop: 24,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 32,
  },
  saveButton: {
    flex: 1,
    borderRadius: 25,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 25,
  },
  buttonContent: {
    paddingVertical: 8,
  },
})
