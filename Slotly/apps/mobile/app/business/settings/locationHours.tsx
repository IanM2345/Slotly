"use client"

import { useEffect, useState } from "react"
import { View, ScrollView, StyleSheet } from "react-native"
import {
  Text,
  Surface,
  ActivityIndicator,
  IconButton,
  Button,
  TextInput,
  useTheme,
  Switch,
  Snackbar,
} from "react-native-paper"
import { useRouter } from "expo-router"
import { VerificationGate } from "../../../components/VerificationGate"
import { Section } from "../../../components/Section"
import { getBusinessProfile, updateBusinessProfile } from "../../../lib/api/manager"
import type { BusinessProfile } from "../../../lib/types"

const DAYS_OF_WEEK = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
]

export default function LocationHoursScreen() {
  const router = useRouter()
  const theme = useTheme()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<BusinessProfile | null>(null)
  const [snackbarVisible, setSnackbarVisible] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState("")

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    setLoading(true)
    try {
      const profileData = await getBusinessProfile("business-1")
      setProfile(profileData)
    } catch (error) {
      console.error("Error loading profile:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!profile) return

    setSaving(true)
    try {
      await updateBusinessProfile("business-1", profile)
      setSnackbarMessage("Location and hours updated successfully")
      setSnackbarVisible(true)
    } catch (error) {
      console.error("Error updating profile:", error)
      setSnackbarMessage("Failed to update information")
      setSnackbarVisible(true)
    } finally {
      setSaving(false)
    }
  }

  const updateAddress = (address: string) => {
    if (!profile) return
    setProfile({ ...profile, address })
  }

  const updateDayHours = (day: string, field: "open" | "start" | "end", value: boolean | string) => {
    if (!profile) return
    setProfile({
      ...profile,
      hours: {
        ...profile.hours,
        [day]: {
          ...profile.hours[day],
          [field]: value,
        },
      },
    })
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading information...</Text>
      </View>
    )
  }

  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load information</Text>
        <Button mode="contained" onPress={loadProfile}>
          Retry
        </Button>
      </View>
    )
  }

  return (
    <VerificationGate>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <IconButton icon="arrow-left" size={24} iconColor={theme.colors.onSurface} onPress={() => router.back()} />
          <Text style={styles.title}>Location & Hours</Text>
        </View>

        <Section title="Business Address">
          <Surface style={styles.formCard} elevation={2}>
            <TextInput
              mode="outlined"
              label="Full Address"
              value={profile.address}
              onChangeText={updateAddress}
              multiline
              numberOfLines={4}
              style={styles.input}
              placeholder="Enter your complete business address including street, city, and postal code"
            />
          </Surface>
        </Section>

        <Section title="Operating Hours">
          <Surface style={styles.hoursCard} elevation={2}>
            {DAYS_OF_WEEK.map((day) => {
              const dayHours = profile.hours[day.key]
              return (
                <View key={day.key} style={styles.dayRow}>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayLabel}>{day.label}</Text>
                    <Switch
                      value={dayHours?.open || false}
                      onValueChange={(value) => updateDayHours(day.key, "open", value)}
                    />
                  </View>

                  {dayHours?.open && (
                    <View style={styles.timeInputs}>
                      <TextInput
                        mode="outlined"
                        label="Open"
                        value={dayHours.start}
                        onChangeText={(text) => updateDayHours(day.key, "start", text)}
                        style={styles.timeInput}
                        placeholder="09:00"
                      />
                      <Text style={styles.timeSeparator}>to</Text>
                      <TextInput
                        mode="outlined"
                        label="Close"
                        value={dayHours.end}
                        onChangeText={(text) => updateDayHours(day.key, "end", text)}
                        style={styles.timeInput}
                        placeholder="18:00"
                      />
                    </View>
                  )}

                  {!dayHours?.open && (
                    <View style={styles.closedIndicator}>
                      <Text style={styles.closedText}>Closed</Text>
                    </View>
                  )}
                </View>
              )
            })}
          </Surface>
        </Section>

        <View style={styles.actionContainer}>
          <Button
            mode="contained"
            onPress={handleSave}
            loading={saving}
            disabled={saving}
            style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
            icon="content-save"
          >
            Save Changes
          </Button>
        </View>

        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={3000}
          action={{
            label: "OK",
            onPress: () => setSnackbarVisible(false),
          }}
        >
          {snackbarMessage}
        </Snackbar>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </VerificationGate>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6B7280",
  },
  errorContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: "#C62828",
    marginBottom: 20,
    textAlign: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1559C1",
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 16,
  },
  input: {
    marginBottom: 16,
  },
  hoursCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 16,
  },
  dayRow: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  dayLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  timeInputs: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  timeInput: {
    flex: 1,
  },
  timeSeparator: {
    fontSize: 14,
    color: "#6B7280",
    paddingHorizontal: 8,
  },
  closedIndicator: {
    paddingVertical: 12,
  },
  closedText: {
    fontSize: 14,
    color: "#9CA3AF",
    fontStyle: "italic",
  },
  actionContainer: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  saveButton: {
    borderRadius: 25,
    paddingVertical: 4,
  },
  bottomSpacing: {
    height: 40,
  },
})