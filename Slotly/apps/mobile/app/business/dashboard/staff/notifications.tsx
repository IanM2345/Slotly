// apps/mobile/app/business/dashboard/staff/schedule.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import {
  Text,
  ActivityIndicator,
  IconButton,
  Button,
  Chip,
  Surface,
  TextInput,
  Banner,
} from "react-native-paper";
import { useRouter } from "expo-router";

import { useSession } from "../../../../context/SessionContext";
import { Section } from "../../../../components/Section";
import {
  staffApi,
  staffAssignedServices,
} from "../../../../lib/api/modules/staff";

// ---- Helpers ----
function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const STATUS_OPTIONS = [
  "ALL",
  "UPCOMING",      // uses ?upcoming=true (+ date)
  "CONFIRMED",
  "PENDING",
  "RESCHEDULED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

type StatusKey = (typeof STATUS_OPTIONS)[number];

export default function StaffScheduleScreen() {
  const router = useRouter();
  const { user, business } = useSession() as any;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [status, setStatus] = useState<StatusKey>("UPCOMING");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [assignedServices, setAssignedServices] = useState<any[]>([]);
  const [serviceId, setServiceId] = useState<string | null>(null);

  // data
  const [bookings, setBookings] = useState<any[]>([]);
  const [actingId, setActingId] = useState<string | null>(null); // while marking

  const businessId = business?.id ?? business?._id ?? undefined;

  const ymd = useMemo(() => toYMD(selectedDate), [selectedDate]);

  // load services user is assigned to (for service filter chips)
  useEffect(() => {
    (async () => {
      try {
        const services = await staffAssignedServices({ businessId });
        setAssignedServices(services || []);
      } catch {}
    })();
  }, [businessId]);

  const load = useCallback(async () => {
    setError(null);
    try {
      setLoading(true);
      const isUpcoming = status === "UPCOMING";
      const effectiveStatus =
        status === "ALL" || status === "UPCOMING" ? undefined : status;

      const data = await staffApi.getSchedule({
        businessId,
        ...(isUpcoming ? { upcoming: true, date: ymd } : {}),
        ...(effectiveStatus ? { status: effectiveStatus } : {}),
        ...(serviceId ? { serviceId } : {}),
      });

      setBookings(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load schedule");
    } finally {
      setLoading(false);
    }
  }, [businessId, status, ymd, serviceId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Quick day nav
  const jumpDay = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d);
  };

  // ------- Actions: mark completed / no-show -------
  const markBooking = useCallback(
    async (id: string, action: "complete" | "no_show") => {
      try {
        setActingId(id);
        await staffApi.markBooking({ id, action, businessId });
        await load();
      } catch (e: any) {
        Alert.alert("Action failed", e?.message || "Please try again.");
      } finally {
        setActingId(null);
      }
    },
    [businessId, load]
  );

  // UI helpers
  const StatusChip = ({ s }: { s: string }) => (
    <Chip compact style={styles.statusChip}>
      {s.replace("_", " ")}
    </Chip>
  );

  const canMark = (b: any) => {
    // Allow marking if not cancelled/no_show/completed
    if (!b) return false;
    const disallowed = new Set(["CANCELLED", "COMPLETED", "NO_SHOW"]);
    return !disallowed.has(String(b.status || "").toUpperCase());
  };

  const renderBooking = (b: any) => {
    const serviceName = b?.service?.name ?? b?.serviceName ?? "Service";
    const customerName = b?.user?.name ?? b?.customerName ?? "Customer";
    const start = new Date(b?.startTime);
    const timeStr = isNaN(start as any)
      ? ""
      : start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    return (
      <Surface key={b?.id} style={styles.card} elevation={1}>
        <View style={styles.cardRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.service}>{serviceName}</Text>
            <Text style={styles.customer}>{customerName}</Text>
            <Text style={styles.time}>{timeStr}</Text>
          </View>
          <StatusChip s={String(b?.status ?? "UNKNOWN")} />
        </View>

        {canMark(b) && (
          <View style={styles.actions}>
            <Button
              mode="contained"
              icon={actingId === b.id ? "progress-check" : "check"}
              onPress={() => markBooking(b.id, "complete")}
              disabled={actingId === b.id}
            >
              {actingId === b.id ? "Marking…" : "Mark Completed"}
            </Button>
            <Button
              mode="outlined"
              icon={actingId === b.id ? "progress-close" : "close-octagon"}
              onPress={() => markBooking(b.id, "no_show")}
              disabled={actingId === b.id}
            >
              {actingId === b.id ? "Marking…" : "Mark No-show"}
            </Button>
          </View>
        )}
      </Surface>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <IconButton icon="arrow-left" size={24} onPress={() => router.back()} />
        <Text style={styles.title}>Schedule</Text>
      </View>

      {error && (
        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <Banner
            visible
            icon="alert"
            actions={[{ label: "Dismiss", onPress: () => setError(null) }]}
          >
            {error}
          </Banner>
        </View>
      )}

      <Section title="Filters">
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          {/* Status filter chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {STATUS_OPTIONS.map((s) => (
                <Chip
                  key={s}
                  selected={status === s}
                  onPress={() => setStatus(s)}
                  compact
                >
                  {s.replace("_", " ")}
                </Chip>
              ))}
            </View>
          </ScrollView>

          {/* Day controls (only matters for UPCOMING) */}
          {status === "UPCOMING" && (
            <View style={styles.dayRow}>
              <Button mode="outlined" onPress={() => jumpDay(-1)} icon="chevron-left">
                Prev day
              </Button>
              <TextInput
                mode="outlined"
                label="Date (YYYY-MM-DD)"
                value={ymd}
                onChangeText={(t) => {
                  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                  if (m) {
                    setSelectedDate(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
                  }
                }}
                right={<TextInput.Icon icon="calendar" />}
                style={{ flex: 1 }}
              />
              <Button mode="outlined" onPress={() => jumpDay(1)} icon="chevron-right">
                Next day
              </Button>
            </View>
          )}

          {/* Assigned services filter chips (optional) */}
          {assignedServices?.length > 0 && (
            <>
              <Text style={{ color: "#6B7280" }}>Filter by service</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Chip
                    selected={!serviceId}
                    onPress={() => setServiceId(null)}
                    compact
                  >
                    All services
                  </Chip>
                  {assignedServices.map((s) => (
                    <Chip
                      key={s.id}
                      selected={serviceId === s.id}
                      onPress={() => setServiceId(s.id)}
                      compact
                    >
                      {s.name}
                    </Chip>
                  ))}
                </View>
              </ScrollView>
            </>
          )}
        </View>
      </Section>

      <Section title="Bookings">
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator />
            <Text style={{ marginTop: 10, color: "#6B7280" }}>Loading…</Text>
          </View>
        ) : bookings.length === 0 ? (
          <View style={{ paddingHorizontal: 16, paddingVertical: 32, alignItems: "center" }}>
            <Text style={{ color: "#6B7280" }}>No bookings match your filters.</Text>
            <Button style={{ marginTop: 12 }} onPress={onRefresh} icon="refresh">
              Refresh
            </Button>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            {bookings.map(renderBooking)}
          </View>
        )}
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: { fontSize: 24, fontWeight: "bold", color: "#1559C1" },
  loading: { alignItems: "center", paddingTop: 32 },

  dayRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  card: { backgroundColor: "#fff", padding: 16, borderRadius: 12 },
  cardRow: { flexDirection: "row", alignItems: "center" },
  statusChip: { alignSelf: "flex-start" },

  service: { fontWeight: "700", fontSize: 16 },
  customer: { color: "#374151", marginTop: 2 },
  time: { color: "#6B7280", marginTop: 4 },

  actions: { marginTop: 12, flexDirection: "row", gap: 12 },
});