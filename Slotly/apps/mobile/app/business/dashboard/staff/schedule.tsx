"use client"

import { useState, useEffect } from "react"
import { ScrollView, View, StyleSheet } from "react-native"
import { Text, Surface, TextInput, useTheme, IconButton, Chip, Menu, Button } from "react-native-paper"
import { SafeAreaView } from "react-native-safe-area-context"
import { useLocalSearchParams } from "expo-router"
import { useToast } from "./_layout"
import { staffApi } from "../../../../../mobile/lib/api/modules/staff"
import type { Appointment } from "../../../../lib/staff/types"

const STATUS_OPTIONS = [
  { label: "All Status", value: "all" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Pending", value: "pending" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
]

export default function StaffScheduleScreen() {
  const { businessId: businessIdParam } = useLocalSearchParams<{ businessId?: string }>();
  const businessId = typeof businessIdParam === "string" ? businessIdParam : undefined;
  
  const theme = useTheme()
  const { notify } = useToast()

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [statusFilter, setStatusFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("")
  const [menuVisible, setMenuVisible] = useState(false)

  useEffect(() => {
    loadSchedule()
  }, [statusFilter, dateFilter, businessId])

  const loadSchedule = async () => {
    try {
      const filters = {
        status: statusFilter !== "all" ? statusFilter : undefined,
        date: dateFilter || undefined,
        businessId,
      }
      const data = await staffApi.getSchedule(filters)
      setAppointments(data)
    } catch (error) {
      notify("Failed to load schedule")
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "#1559C1"
      case "pending":
        return "#FBC02D"
      case "completed":
        return "#4CAF50"
      case "cancelled":
        return "#F44336"
      default:
        return theme.colors.outline
    }
  }

  const AppointmentCard = ({ appointment }: { appointment: Appointment }) => (
    <Surface style={styles.appointmentCard} elevation={1}>
      <View style={styles.appointmentContent}>
        <View style={styles.timeSection}>
          <Text variant="headlineSmall" style={[styles.timeText, { color: theme.colors.primary }]}>
            {appointment.time}
          </Text>
        </View>

        <View style={styles.appointmentInfo}>
          <Text variant="titleMedium" style={[styles.clientName, { color: theme.colors.onBackground }]}>
            {appointment.clientName}
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {appointment.service}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {appointment.duration}
          </Text>
        </View>

        <Chip
          style={[styles.statusChip, { backgroundColor: getStatusColor(appointment.status) }]}
          textStyle={{ color: "#FFFFFF", fontSize: 12 }}
        >
          {appointment.status}
        </Chip>
      </View>
    </Surface>
  )

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <IconButton icon="menu" size={24} iconColor={theme.colors.onBackground} style={styles.menuButton} />
          <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onBackground }]}>
            My Schedule
          </Text>
        </View>

        {/* Filters */}
        <Surface style={styles.filtersCard} elevation={1}>
          <View style={styles.filtersRow}>
            <Menu
              visible={menuVisible}
              onDismiss={() => setMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  onPress={() => setMenuVisible(true)}
                  style={styles.statusFilter}
                  contentStyle={styles.filterButtonContent}
                >
                  {STATUS_OPTIONS.find((opt) => opt.value === statusFilter)?.label}
                </Button>
              }
            >
              {STATUS_OPTIONS.map((option) => (
                <Menu.Item
                  key={option.value}
                  onPress={() => {
                    setStatusFilter(option.value)
                    setMenuVisible(false)
                  }}
                  title={option.label}
                />
              ))}
            </Menu>

            <TextInput
              label="Date (mm/dd/yyyy)"
              value={dateFilter}
              onChangeText={setDateFilter}
              mode="outlined"
              style={styles.dateFilter}
              right={<TextInput.Icon icon="calendar" />}
              dense
            />
          </View>
        </Surface>

        {/* Appointments List */}
        <View style={styles.appointmentsList}>
          {appointments.length === 0 ? (
            <Surface style={styles.emptyState} elevation={1}>
              <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, textAlign: "center" }}>
                No appointments found
              </Text>
            </Surface>
          ) : (
            appointments.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} />)
          )}
        </View>
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
  filtersCard: {
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    padding: 16,
    marginBottom: 16,
  },
  filtersRow: {
    flexDirection: "row",
    gap: 12,
  },
  statusFilter: {
    flex: 1,
  },
  dateFilter: {
    flex: 1,
  },
  filterButtonContent: {
    paddingVertical: 4,
  },
  appointmentsList: {
    gap: 12,
  },
  appointmentCard: {
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
  },
  appointmentContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
  },
  timeSection: {
    marginRight: 20,
  },
  timeText: {
    fontWeight: "700",
  },
  appointmentInfo: {
    flex: 1,
  },
  clientName: {
    fontWeight: "600",
    marginBottom: 4,
  },
  statusChip: {
    borderRadius: 12,
  },
  emptyState: {
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    padding: 48,
  },
})