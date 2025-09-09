"use client";

import { useEffect, useMemo, useState } from "react";
import { View, ScrollView, StyleSheet, Alert, Platform } from "react-native";
import {
  Text,
  Surface,
  ActivityIndicator,
  IconButton,
  Button,
  useTheme,
  Dialog,
  Portal,
  Chip,
  Snackbar,
} from "react-native-paper";
import { useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";

import { VerificationGate } from "../../../../components/VerificationGate";
import { Section } from "../../../../components/Section";
import { FilterChipsRow } from "../../../../components/FilterChipsRow";
import { StatusPill } from "../../../../components/StatusPill";

// Manager API
import {
  listBookings,
  listStaff,
  reassignBookingStaff,
  rescheduleBooking,
  cancelManagerBooking,
  markBookingCompleted,
  markBookingNoShow,
} from "../../../../lib/api/modules/manager";

// No need to import payment API anymore - backend provides paidViaApp

type BookingRow = {
  id: string;
  status: "CONFIRMED" | "PENDING" | "CANCELLED" | "COMPLETED" | "NO_SHOW" | "RESCHEDULED";
  startTime: string; // ISO
  endTime?: string;  // ISO (optional)
  user?: { id: string; name?: string; email?: string };
  staff?: { id: string; name?: string } | null;
  service?: { id: string; name?: string; duration?: number };
  price?: number;
  businessId?: string;
  lateCancellationFee?: number | null;
  cancellationDeadlineMinutes?: number | null;
  paidViaApp?: boolean; // Added by backend
};

type StaffLite = { id: string; name?: string };

export default function BookingsManageScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [filters, setFilters] = useState<string[]>(["All"]);
  const [snackbar, setSnackbar] = useState<{ visible: boolean; msg: string }>({ visible: false, msg: "" });

  // Reassign dialog
  const [reassignOpen, setReassignOpen] = useState<null | BookingRow>(null);
  const [staffList, setStaffList] = useState<StaffLite[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");

  // Reschedule dialog
  const [reschedOpen, setReschedOpen] = useState<null | BookingRow>(null);
  const [newDate, setNewDate] = useState<Date>(new Date());
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);

  useEffect(() => {
    load();
  }, [filters]);

  async function load() {
    setLoading(true);
    try {
      const params: any = {};
      if (filters[0] === "Today") params.date = new Date().toISOString().slice(0, 10);
      const rows = await listBookings(params);
      setBookings(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      console.error(e);
      Alert.alert("Error", e?.message || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }

  const filterOptions = [
    { key: "All", label: "All" },
    { key: "Today", label: "Today" },
    { key: "Confirmed", label: "Confirmed" },
    { key: "Pending", label: "Pending" },
    { key: "Cancelled", label: "Cancelled" },
    { key: "Completed", label: "Completed" },
    { key: "No-Show", label: "No-Show" },
  ];

  const filtered = useMemo(() => {
    const f = filters[0];
    if (f === "All" || f === "Today") return bookings;
    const map: Record<string, BookingRow["status"]> = {
      Confirmed: "CONFIRMED",
      Pending: "PENDING",
      Cancelled: "CANCELLED",
      Completed: "COMPLETED",
      "No-Show": "NO_SHOW",
    };
    const status = map[f];
    return status ? bookings.filter((b) => b.status === status) : bookings;
  }, [bookings, filters]);

  function fmtDay(d: string) {
    const dt = new Date(d);
    return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  function fmtTime(d: string) {
    const dt = new Date(d);
    return dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }

  async function openReassign(b: BookingRow) {
    try {
      setReassignOpen(b);
      const resp = await listStaff();
      setStaffList(resp?.approvedStaff || []);
      setSelectedStaffId(b.staff?.id || "");
    } catch (e) {
      console.error(e);
    }
  }
  async function saveReassign() {
    if (!reassignOpen || !selectedStaffId) return;
    try {
      await reassignBookingStaff({ id: reassignOpen.id, staffId: selectedStaffId });
      setReassignOpen(null);
      setSnackbar({ visible: true, msg: "Staff reassigned" });
      await load();
    } catch (e: any) {
      Alert.alert("Reassign failed", e?.message || "Unable to reassign");
    }
  }

  function openReschedule(b: BookingRow) {
    setReschedOpen(b);
    setNewDate(new Date(b.startTime));
  }
  async function saveReschedule() {
    if (!reschedOpen) return;
    try {
      await rescheduleBooking({ id: reschedOpen.id, startTime: newDate.toISOString() });
      setReschedOpen(null);
      setSnackbar({ visible: true, msg: "Booking rescheduled" });
      await load();
    } catch (e: any) {
      Alert.alert("Reschedule failed", e?.message || "Unable to reschedule");
    }
  }

  // Small helper to wrap Alert into a promise for async/await ergonomics
  function confirmAsync(title: string, message: string): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(title, message, [
        { text: "No", style: "cancel", onPress: () => resolve(false) },
        { text: "Yes", style: "destructive", onPress: () => resolve(true) },
      ]);
    });
  }

  async function doCancel(b: BookingRow) {
    try {
      // Use server-provided paidViaApp flag instead of making extra API call
      const paidApp = !!(b as any).paidViaApp;

      const proceed = await confirmAsync(
        paidApp ? "Refund & Cancel" : "Cancel booking?",
        paidApp
          ? "This booking was paid in-app (IntaSend). A refund will be initiated before the booking is cancelled. Continue?"
          : "Are you sure you want to cancel this booking?"
      );
      if (!proceed) return;

      const resp = await cancelManagerBooking({ id: b.id, reason: "Cancelled by manager" });
      setSnackbar({ visible: true, msg: resp?.message || (paidApp ? "Cancelled and refund initiated" : "Booking cancelled") });

      await load();
    } catch (e: any) {
      Alert.alert("Cancel failed", e?.message || "Unable to cancel");
    }
  }

  async function doComplete(b: BookingRow) {
    try {
      await markBookingCompleted({ id: b.id });
      setSnackbar({ visible: true, msg: "Marked as completed" });
      await load();
    } catch (e: any) {
      Alert.alert("Failed", e?.message || "Unable to mark completed");
    }
  }

  async function doNoShow(b: BookingRow) {
    try {
      await markBookingNoShow({ id: b.id });
      setSnackbar({ visible: true, msg: "Marked as no-show" });
      await load();
    } catch (e: any) {
      Alert.alert("Failed", e?.message || "Unable to mark no-show");
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading bookings…</Text>
      </View>
    );
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
            selectedKeys={filters}
            onSelectionChange={setFilters}
            multiSelect={false}
          />
        </Section>

        {/* Bookings List */}
        <Section title={`Bookings (${filtered.length})`}>
          <View style={styles.bookingsContainer}>
            {filtered.length === 0 ? (
              <Surface style={styles.emptyState} elevation={1}>
                <Text style={styles.emptyText}>No bookings yet.</Text>
                <Text style={styles.emptySubtext}>They'll appear here once customers start booking.</Text>
              </Surface>
            ) : (
              filtered.map((b) => (
                <Surface key={b.id} style={styles.bookingCard} elevation={2}>
                  <View style={styles.bookingHeader}>
                    <View>
                      <Text style={styles.timeText}>{fmtTime(b.startTime)}</Text>
                      <Text style={styles.dateText}>{fmtDay(b.startTime)}</Text>
                    </View>
                    <StatusPill status={b.status} />
                  </View>

                  <View style={styles.bookingDetails}>
                    <Text style={styles.serviceInfo}>
                      {b.service?.name ?? "Service"} • {b.staff?.name ?? "Unassigned"}
                    </Text>
                    <Text style={styles.clientName}>{b.user?.name ?? "Customer"}</Text>
                    {!!b.price && <Text style={styles.priceText}>KSh {b.price.toLocaleString()}</Text>}
                  </View>

                  <View style={styles.bookingActions}>
                    <Button mode="outlined" compact style={styles.actionBtn} onPress={() => openReassign(b)}>
                      Reassign
                    </Button>
                    <Button mode="outlined" compact style={styles.actionBtn} onPress={() => openReschedule(b)}>
                      Reschedule
                    </Button>
                    <Button
                      mode="contained"
                      compact
                      style={styles.actionBtn}
                      onPress={() => doCancel(b)}
                      disabled={b.status === "CANCELLED" || b.status === "COMPLETED" || b.status === "NO_SHOW"}
                    >
                      Cancel
                    </Button>
                    <Button
                      mode="text"
                      compact
                      style={styles.actionBtn}
                      onPress={() => doComplete(b)}
                      disabled={b.status === "CANCELLED" || b.status === "COMPLETED" || b.status === "NO_SHOW"}
                    >
                      Complete
                    </Button>
                    <Button
                      mode="text"
                      compact
                      style={styles.actionBtn}
                      onPress={() => doNoShow(b)}
                      disabled={b.status === "CANCELLED" || b.status === "COMPLETED" || b.status === "NO_SHOW"}
                    >
                      No-Show
                    </Button>
                  </View>
                </Surface>
              ))
            )}
          </View>
        </Section>

        {/* Reassign dialog */}
        <Portal>
          <Dialog visible={!!reassignOpen} onDismiss={() => setReassignOpen(null)}>
            <Dialog.Title>Reassign Staff</Dialog.Title>
            <Dialog.Content>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {staffList.map((s) => (
                  <Chip
                    key={s.id}
                    selected={selectedStaffId === s.id}
                    onPress={() => setSelectedStaffId(s.id)}
                    compact
                  >
                    {s.name || "Staff"}
                  </Chip>
                ))}
              </View>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setReassignOpen(null)}>Close</Button>
              <Button onPress={saveReassign} disabled={!selectedStaffId}>Save</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        {/* Reschedule dialog */}
        <Portal>
          <Dialog visible={!!reschedOpen} onDismiss={() => setReschedOpen(null)}>
            <Dialog.Title>Reschedule</Dialog.Title>
            <Dialog.Content>
              <Button onPress={() => setShowDate(true)} style={{ marginBottom: 8 }}>
                Pick Date
              </Button>
              <Button onPress={() => setShowTime(true)}>Pick Time</Button>

              {showDate && (
                <DateTimePicker
                  value={newDate}
                  mode="date"
                  display={Platform.OS === "ios" ? "inline" : "default"}
                  onChange={(_, d) => {
                    setShowDate(false);
                    if (d) {
                      const nd = new Date(newDate);
                      nd.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
                      setNewDate(nd);
                    }
                  }}
                />
              )}
              {showTime && (
                <DateTimePicker
                  value={newDate}
                  mode="time"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(_, d) => {
                    setShowTime(false);
                    if (d) {
                      const nd = new Date(newDate);
                      nd.setHours(d.getHours(), d.getMinutes(), 0, 0);
                      setNewDate(nd);
                    }
                  }}
                />
              )}
              <Text style={{ marginTop: 12, color: "#6B7280" }}>
                New start: {newDate.toLocaleString()}
              </Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setReschedOpen(null)}>Close</Button>
              <Button onPress={saveReschedule}>Save</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        <Snackbar
          visible={snackbar.visible}
          onDismiss={() => setSnackbar({ visible: false, msg: "" })}
          duration={2500}
        >
          {snackbar.msg}
        </Snackbar>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </VerificationGate>
  );
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
  bottomSpacing: {
    height: 40,
  },
});