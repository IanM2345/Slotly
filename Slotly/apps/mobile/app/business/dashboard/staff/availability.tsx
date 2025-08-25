"use client"

import { useState, useEffect } from "react"
import { ScrollView, View, StyleSheet } from "react-native"
import {
  Text,
  Surface,
  TextInput,
  Button,
  useTheme,
  IconButton,
  Checkbox,
  Dialog,
  Portal,
  Chip,
} from "react-native-paper"
import { SafeAreaView } from "react-native-safe-area-context"
import { useLocalSearchParams } from "expo-router"
import { useToast } from "./_layout"
import { staffApi } from "../../../../../mobile/lib/api/modules/staff"
import type { WeeklyAvailability, TimeOffRequest } from "../../../../lib/staff/types"

const DAYS = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
]

export default function StaffAvailabilityScreen() {
  const { businessId: businessIdParam } = useLocalSearchParams<{ businessId?: string }>();
  const businessId = typeof businessIdParam === "string" ? businessIdParam : undefined;
  
  const theme = useTheme()
  const { notify } = useToast()

  const [loading, setLoading] = useState(false)
  const [availability, setAvailability] = useState<WeeklyAvailability>({})
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([])
  const [dialogVisible, setDialogVisible] = useState(false)
  const [timeOffData, setTimeOffData] = useState({
    fromDate: "",
    toDate: "",
    reason: "",
  })

  useEffect(() => {
    loadData()
  }, [businessId])

  const loadData = async () => {
    try {
      const [availabilityData, timeOffData] = await Promise.all([
        staffApi.getAvailability({ businessId }),
        staffApi.getTimeOffRequests({ businessId }),
      ])
      setAvailability(availabilityData)
      setTimeOffRequests(timeOffData)
    } catch (error) {
      notify("Failed to load data")
    }
  }

  const handleAvailabilityChange = (day: string, field: string, value: any) => {
    setAvailability((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }))
  }

  const handleUpdateAvailability = async () => {
    setLoading(true)
    try {
      await staffApi.saveAvailability(availability, { businessId })
      notify("Availability updated successfully")
    } catch (error) {
      notify("Failed to update availability")
    } finally {
      setLoading(false)
    }
  }

  const handleRequestTimeOff = async () => {
    if (!timeOffData.fromDate || !timeOffData.toDate || !timeOffData.reason) {
      notify("Please fill all fields")
      return
    }

    try {
      await staffApi.requestTimeOff(timeOffData, { businessId })
      notify("Time-off request submitted")
      setDialogVisible(false)
      setTimeOffData({ fromDate: "", toDate: "", reason: "" })
      loadData() // Refresh the list
    } catch (error) {
      notify("Failed to submit request")
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "#FBC02D"
      case "approved":
        return "#4CAF50"
      case "rejected":
        return "#F44336"
      default:
        return theme.colors.outline
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <IconButton icon="menu" size={24} iconColor={theme.colors.onBackground} style={styles.menuButton} />
          <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onBackground }]}>
            Availability & Time-off
          </Text>
          <Button
            mode="contained"
            onPress={() => setDialogVisible(true)}
            style={[styles.requestButton, { backgroundColor: theme.colors.primary }]}
            labelStyle={{ color: theme.colors.onPrimary }}
            icon="plus"
            compact
          >
            Request Time-off
          </Button>
        </View>

        {/* Weekly Availability */}
        <Surface style={styles.availabilityCard} elevation={1}>
          <Text variant="titleLarge" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
            Weekly Availability
          </Text>

          {DAYS.map(({ key, label }) => (
            <View key={key} style={styles.dayRow}>
              <View style={styles.dayInfo}>
                <Text variant="bodyLarge" style={[styles.dayLabel, { color: theme.colors.onBackground }]}>
                  {label}
                </Text>
              </View>

              <View style={styles.timeInputs}>
                <TextInput
                  value={availability[key]?.startTime || "09:00"}
                  onChangeText={(text) => handleAvailabilityChange(key, "startTime", text)}
                  mode="outlined"
                  style={styles.timeInput}
                  dense
                />
                <Text variant="bodyMedium" style={[styles.toText, { color: theme.colors.onSurfaceVariant }]}>
                  to
                </Text>
                <TextInput
                  value={availability[key]?.endTime || "17:00"}
                  onChangeText={(text) => handleAvailabilityChange(key, "endTime", text)}
                  mode="outlined"
                  style={styles.timeInput}
                  dense
                />
                <IconButton icon="clock-outline" size={20} iconColor={theme.colors.onSurfaceVariant} />
                <Checkbox
                  status={availability[key]?.enabled ? "checked" : "unchecked"}
                  onPress={() => handleAvailabilityChange(key, "enabled", !availability[key]?.enabled)}
                  color={theme.colors.primary}
                />
              </View>
            </View>
          ))}

          <Button
            mode="contained"
            onPress={handleUpdateAvailability}
            loading={loading}
            disabled={loading}
            style={[styles.updateButton, { backgroundColor: "#FBC02D" }]}
            labelStyle={{ color: theme.colors.onPrimary }}
            contentStyle={styles.buttonContent}
          >
            Update Availability
          </Button>
        </Surface>

        {/* Time-off Requests */}
        {timeOffRequests.length > 0 && (
          <Surface style={styles.timeOffCard} elevation={1}>
            <Text variant="titleLarge" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
              Time-off Requests
            </Text>

            {timeOffRequests.map((request) => (
              <View key={request.id} style={styles.requestRow}>
                <View style={styles.requestInfo}>
                  <Text variant="bodyLarge" style={{ color: theme.colors.onBackground }}>
                    {request.fromDate} - {request.toDate}
                  </Text>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    {request.reason}
                  </Text>
                </View>
                <Chip
                  style={[styles.statusChip, { backgroundColor: getStatusColor(request.status) }]}
                  textStyle={{ color: "#FFFFFF", fontSize: 12 }}
                >
                  {request.status}
                </Chip>
              </View>
            ))}
          </Surface>
        )}
      </ScrollView>

      {/* Time-off Request Dialog */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>Request Time-off</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="From Date (YYYY-MM-DD)"
              value={timeOffData.fromDate}
              onChangeText={(text) => setTimeOffData((prev) => ({ ...prev, fromDate: text }))}
              mode="outlined"
              style={styles.dialogInput}
            />
            <TextInput
              label="To Date (YYYY-MM-DD)"
              value={timeOffData.toDate}
              onChangeText={(text) => setTimeOffData((prev) => ({ ...prev, toDate: text }))}
              mode="outlined"
              style={styles.dialogInput}
            />
            <TextInput
              label="Reason"
              value={timeOffData.reason}
              onChangeText={(text) => setTimeOffData((prev) => ({ ...prev, reason: text }))}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.dialogInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleRequestTimeOff}>Submit</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
    justifyContent: "space-between",
    marginBottom: 24,
  },
  menuButton: {
    marginRight: 8,
  },
  title: {
    fontWeight: "700",
    flex: 1,
  },
  requestButton: {
    borderRadius: 20,
  },
  availabilityCard: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    padding: 24,
    marginBottom: 16,
  },
  timeOffCard: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    padding: 24,
  },
  sectionTitle: {
    fontWeight: "600",
    marginBottom: 20,
  },
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  dayInfo: {
    flex: 1,
  },
  dayLabel: {
    fontWeight: "500",
  },
  timeInputs: {
    flexDirection: "row",
    alignItems: "center",
    flex: 2,
  },
  timeInput: {
    width: 80,
    marginHorizontal: 4,
  },
  toText: {
    marginHorizontal: 8,
  },
  updateButton: {
    borderRadius: 25,
    marginTop: 24,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  requestRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  requestInfo: {
    flex: 1,
  },
  statusChip: {
    borderRadius: 12,
  },
  dialogInput: {
    marginBottom: 16,
  },
})