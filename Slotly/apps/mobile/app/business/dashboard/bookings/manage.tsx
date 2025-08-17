"use client"

import { useEffect, useState } from "react"
import { View, ScrollView, StyleSheet } from "react-native"
import {
  Text,
  Surface,
  ActivityIndicator,
  IconButton,
  Button,
  useTheme,
  Portal,
  Modal,
  TextInput,
  Snackbar,
} from "react-native-paper"
import { useRouter } from "expo-router"
import { VerificationGate } from "../../../../components/VerificationGate"
import { Section } from "../../../../components/Section"
import { FilterChipsRow } from "../../../../components/FilterChipsRow"
import { StatusPill } from "../../../../components/StatusPill"
import { ConfirmDialog } from "../../../../components/ConfirmDialog"
import { getBookings, createWalkInBooking, getServices, getStaffList } from "../../../../lib/api/manager"
import type { Booking, BookingStatus, Service, Staff } from "../../../../lib/types"

export default function BookingsManageScreen() {
  const router = useRouter()
  const theme = useTheme()
  const [loading, setLoading] = useState(true)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [selectedFilters, setSelectedFilters] = useState(["All"])
  const [showWalkInModal, setShowWalkInModal] = useState(false)
  const [walkInForm, setWalkInForm] = useState({
    clientName: "",
    clientPhone: "",
    serviceId: "",
    staffId: "",
    date: new Date().toISOString().split("T")[0],
    time: "10:00",
  })
  const [snackbarVisible, setSnackbarVisible] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState("")

  useEffect(() => {
    loadData()
  }, [selectedFilters])

  const loadData = async () => {
    setLoading(true)
    try {
      const [bookingsData, servicesData, staffData] = await Promise.all([
        getBookings("business-1", getBookingFilters()),
        getServices("business-1"),
        getStaffList("business-1"),
      ])
      setBookings(bookingsData.rows)
      setServices(servicesData)
      setStaff(staffData)
    } catch (error) {
      console.error("Error loading bookings:", error)
    } finally {
      setLoading(false)
    }
  }

  const getBookingFilters = () => {
    const filters = selectedFilters[0]
    switch (filters) {
      case "Today":
        return { range: "TODAY" as const }
      case "Tomorrow":
        return { range: "TOMORROW" as const }
      case "This Week":
        return { range: "THIS_WEEK" as const }
      case "Confirmed":
        return { status: "CONFIRMED" as BookingStatus }
      case "Pending":
        return { status: "PENDING" as BookingStatus }
      case "Cancelled":
        return { status: "CANCELLED" as BookingStatus }
      default:
        return {}
    }
  }

  const handleCreateWalkIn = async () => {
    if (!walkInForm.clientName || !walkInForm.clientPhone || !walkInForm.serviceId || !walkInForm.staffId) {
      setSnackbarMessage("Please fill all required fields")
      setSnackbarVisible(true)
      return
    }

    try {
      const service = services.find((s) => s.id === walkInForm.serviceId)
      const staffMember = staff.find((s) => s.id === walkInForm.staffId)

      if (!service || !staffMember) return

      const newBooking = await createWalkInBooking({
        client: {
          name: walkInForm.clientName,
          phone: walkInForm.clientPhone,
        },
        serviceId: walkInForm.serviceId,
        serviceName: service.name,
        staffId: walkInForm.staffId,
        staffName: staffMember.name,
        dateISO: walkInForm.date,
        timeISO: walkInForm.time,
        price: service.price,
      })

      setBookings((prev) => [newBooking, ...prev])
      setShowWalkInModal(false)
      setWalkInForm({
        clientName: "",
        clientPhone: "",
        serviceId: "",
        staffId: "",
        date: new Date().toISOString().split("T")[0],
        time: "10:00",
      })
      setSnackbarMessage("Walk-in booking created successfully")
      setSnackbarVisible(true)
    } catch (error) {
      console.error("Error creating walk-in booking:", error)
      setSnackbarMessage("Failed to create booking")
      setSnackbarVisible(true)
    }
  }

  const filterOptions = [
    { key: "All", label: "All" },
    { key: "Today", label: "Today" },
    { key: "Tomorrow", label: "Tomorrow" },
    { key: "This Week", label: "This Week" },
    { key: "Confirmed", label: "Confirmed" },
    { key: "Pending", label: "Pending" },
    { key: "Cancelled", label: "Cancelled" },
  ]

  const formatTime = (timeISO: string) => {
    return new Date(`2000-01-01T${timeISO}`).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }

  const formatDate = (dateISO: string) => {
    return new Date(dateISO).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading bookings...</Text>
      </View>
    )
  }

  return (
    <VerificationGate>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <IconButton icon="arrow-left" size={24} iconColor={theme.colors.onSurface} onPress={() => router.back()} />
          <Text style={styles.title}>Bookings Management</Text>
        </View>

        {/* Filters */}
        <Section title="Filters">
          <FilterChipsRow
            options={filterOptions}
            selectedKeys={selectedFilters}
            onSelectionChange={setSelectedFilters}
            multiSelect={false}
          />
        </Section>

        {/* Create Walk-in Button */}
        <View style={styles.actionContainer}>
          <Button
            mode="contained"
            onPress={() => setShowWalkInModal(true)}
            style={[styles.walkInButton, { backgroundColor: theme.colors.secondary }]}
            icon="plus"
          >
            Create Walk-in Booking
          </Button>
        </View>

        {/* Bookings List */}
        <Section title={`Bookings (${bookings.length})`}>
          <View style={styles.bookingsContainer}>
            {bookings.length === 0 ? (
              <Surface style={styles.emptyState} elevation={1}>
                <Text style={styles.emptyText}>No bookings found</Text>
                <Text style={styles.emptySubtext}>Try adjusting your filters or create a new booking</Text>
              </Surface>
            ) : (
              bookings.map((booking) => (
                <Surface key={booking.id} style={styles.bookingCard} elevation={2}>
                  <View style={styles.bookingHeader}>
                    <View style={styles.bookingTime}>
                      <Text style={styles.timeText}>{formatTime(booking.timeISO)}</Text>
                      <Text style={styles.dateText}>{formatDate(booking.dateISO)}</Text>
                    </View>
                    <StatusPill status={booking.status} />
                  </View>

                  <View style={styles.bookingDetails}>
                    <Text style={styles.clientName}>{booking.client.name}</Text>
                    <Text style={styles.clientPhone}>{booking.client.phone}</Text>
                    <Text style={styles.serviceInfo}>
                      {booking.serviceName} with {booking.staffName}
                    </Text>
                    <Text style={styles.priceText}>KSh {booking.price.toLocaleString()}</Text>
                  </View>

                  <View style={styles.bookingActions}>
                    <Button mode="outlined" compact style={styles.actionBtn}>
                      Reschedule
                    </Button>
                    <Button mode="outlined" compact style={styles.actionBtn}>
                      Cancel
                    </Button>
                    <Button mode="contained" compact style={styles.actionBtn}>
                      Complete
                    </Button>
                  </View>
                </Surface>
              ))
            )}
          </View>
        </Section>

        {/* Walk-in Booking Modal */}
        <Portal>
          <Modal
            visible={showWalkInModal}
            onDismiss={() => setShowWalkInModal(false)}
            contentContainerStyle={styles.modalContainer}
          >
            <Surface style={styles.modalContent} elevation={4}>
              <Text style={styles.modalTitle}>Create Walk-in Booking</Text>

              <TextInput
                mode="outlined"
                label="Client Name *"
                value={walkInForm.clientName}
                onChangeText={(text) => setWalkInForm((prev) => ({ ...prev, clientName: text }))}
                style={styles.input}
              />

              <TextInput
                mode="outlined"
                label="Client Phone *"
                value={walkInForm.clientPhone}
                onChangeText={(text) => setWalkInForm((prev) => ({ ...prev, clientPhone: text }))}
                keyboardType="phone-pad"
                style={styles.input}
              />

              <TextInput
                mode="outlined"
                label="Date"
                value={walkInForm.date}
                onChangeText={(text) => setWalkInForm((prev) => ({ ...prev, date: text }))}
                style={styles.input}
              />

              <TextInput
                mode="outlined"
                label="Time"
                value={walkInForm.time}
                onChangeText={(text) => setWalkInForm((prev) => ({ ...prev, time: text }))}
                style={styles.input}
              />

              <View style={styles.modalActions}>
                <Button mode="outlined" onPress={() => setShowWalkInModal(false)} style={styles.modalButton}>
                  Cancel
                </Button>
                <Button mode="contained" onPress={handleCreateWalkIn} style={styles.modalButton}>
                  Create Booking
                </Button>
              </View>
            </Surface>
          </Modal>
        </Portal>

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
  actionContainer: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  walkInButton: {
    borderRadius: 25,
  },
  bookingsContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  emptyState: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
  },
  bookingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
  },
  bookingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  bookingTime: {
    alignItems: "flex-start",
  },
  timeText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1F2937",
  },
  dateText: {
    fontSize: 12,
    color: "#6B7280",
  },
  bookingDetails: {
    marginBottom: 16,
  },
  clientName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 2,
  },
  clientPhone: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },
  serviceInfo: {
    fontSize: 14,
    color: "#374151",
    marginBottom: 4,
  },
  priceText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2E7D32",
  },
  bookingActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1559C1",
    marginBottom: 20,
  },
  input: {
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
  },
  bottomSpacing: {
    height: 40,
  },
})