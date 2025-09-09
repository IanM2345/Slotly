// apps/mobile/app/business/dashboard/staff/index.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Divider,
  IconButton,
  List,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import { staffApi } from "../../../../lib/api/modules/staff";

type Booking = {
  id: string;
  startTime: string | Date;
  endTime: string | Date;
  status:
    | "PENDING"
    | "CONFIRMED"
    | "CANCELLED"
    | "COMPLETED"
    | "NO_SHOW"
    | "RESCHEDULED";
  serviceId?: string;
  serviceName?: string;
  servicePrice?: number | null;
  serviceDuration?: number | null;
  customer?: { id: string; name: string; avatarUrl?: string | null } | null;
};

type AssignedService = {
  id: string;
  name: string;
  price: number;
  duration: number;
  businessId: string;
};

const STATUS_TABS = [
  { key: "UPCOMING", label: "Upcoming" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "NO_SHOW", label: "No-show" },
  { key: "CANCELLED", label: "Cancelled" },
] as const;

type StatusKey = (typeof STATUS_TABS)[number]["key"];

export default function StaffHubScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);

  // services + filters
  const [services, setServices] = useState<AssignedService[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    null
  );
  const [statusKey, setStatusKey] = useState<StatusKey>("UPCOMING");

  // data cards + lists
  const [metrics, setMetrics] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  // counts per status (so chips show live numbers)
  const [counts, setCounts] = useState<Record<StatusKey, number>>({
    UPCOMING: 0,
    CONFIRMED: 0,
    NO_SHOW: 0,
    CANCELLED: 0,
  });

  // Startup: determine business scope, load metrics / services / notifications / initial bookings + counts
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const ctx = await staffApi.getStaffMe().catch(() => null);
        const bizId = ctx?.activeBusiness?.id || ctx?.businesses?.[0]?.id || null;
        if (!mounted) return;

        setBusinessId(bizId);

        const [m, notif, svc] = await Promise.all([
          staffApi.getPerformanceMetrics({ businessId: bizId }).catch(() => null),
          staffApi.getNotifications({ businessId: bizId }).catch(() => []),
          staffApi.getAssignedServices({ businessId: bizId }).catch(() => []),
        ]);

        if (!mounted) return;
        setMetrics(m);
        setNotes(Array.isArray(notif) ? notif : []);
        setServices(Array.isArray(svc) ? svc : []);

        // initial bookings (UPCOMING, all services)
        const [upcoming, confirmed, noShow, cancelled] = await Promise.all([
          staffApi
            .getBookingsByStatus({ businessId: bizId, status: "UPCOMING" })
            .catch(() => []),
          staffApi
            .getBookingsByStatus({ businessId: bizId, status: "CONFIRMED" })
            .catch(() => []),
          staffApi
            .getBookingsByStatus({ businessId: bizId, status: "NO_SHOW" })
            .catch(() => []),
          staffApi
            .getBookingsByStatus({ businessId: bizId, status: "CANCELLED" })
            .catch(() => []),
        ]);

        if (!mounted) return;

        setBookings(upcoming);
        setCounts({
          UPCOMING: upcoming.length,
          CONFIRMED: confirmed.length,
          NO_SHOW: noShow.length,
          CANCELLED: cancelled.length,
        });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // When filters change, refetch both the visible list and the counts (counts respect selectedServiceId)
  useEffect(() => {
    if (!businessId) return;

    (async () => {
      // visible list
      const list = await staffApi
        .getBookingsByStatus({
          businessId,
          status: statusKey,
          serviceId: selectedServiceId || undefined,
        })
        .catch(() => []);
      setBookings(list);

      // counts for all tabs (parallel)
      const [upcoming, confirmed, noShow, cancelled] = await Promise.all([
        staffApi
          .getBookingsByStatus({
            businessId,
            status: "UPCOMING",
            serviceId: selectedServiceId || undefined,
          })
          .catch(() => []),
        staffApi
          .getBookingsByStatus({
            businessId,
            status: "CONFIRMED",
            serviceId: selectedServiceId || undefined,
          })
          .catch(() => []),
        staffApi
          .getBookingsByStatus({
            businessId,
            status: "NO_SHOW",
            serviceId: selectedServiceId || undefined,
          })
          .catch(() => []),
        staffApi
          .getBookingsByStatus({
            businessId,
            status: "CANCELLED",
            serviceId: selectedServiceId || undefined,
          })
          .catch(() => []),
      ]);

      setCounts({
        UPCOMING: upcoming.length,
        CONFIRMED: confirmed.length,
        NO_SHOW: noShow.length,
        CANCELLED: cancelled.length,
      });
    })();
  }, [businessId, statusKey, selectedServiceId]);

  const unreadCount = useMemo(
    () => notes.filter((n: any) => !n.isRead).length,
    [notes]
  );

  const fmtTime = (d: string | Date) => {
    const date = typeof d === "string" ? new Date(d) : d;
    const hh = date.getHours().toString().padStart(2, "0");
    const mm = date.getMinutes().toString().padStart(2, "0");
    return `${hh}:${mm}`;
  };

  const gotoSettings = () => router.replace("/settings");
  const gotoPerformance = () =>
    router.push({
      pathname: "/business/dashboard/staff/performance",
      params: { businessId: businessId || "" },
    } as any);
  const gotoProfile = () =>
    router.push({
      pathname: "/business/dashboard/staff/profile",
      params: { businessId: businessId || "" },
    } as any);
  const gotoSchedule = () =>
    router.push({
      pathname: "/business/dashboard/staff/schedule",
      params: { businessId: businessId || "" },
    } as any);
  const gotoNotifications = () =>
    router.push({
      pathname: "/business/dashboard/staff/notifications",
      params: { businessId: businessId || "" },
    } as any);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      <View style={styles.header}>
        <IconButton icon="arrow-left" size={24} onPress={gotoSettings} />
        <Text style={styles.title}>Staff Dashboard</Text>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator />
          <Text style={{ marginTop: 10, color: "#6B7280" }}>Loading…</Text>
        </View>
      ) : (
        <>
          {/* Quick actions */}
          <View style={[styles.row, { paddingHorizontal: 12 }]}>
            <Card style={styles.action} onPress={gotoNotifications}>
              <Card.Title
                title="Notifications"
                left={(p) => <List.Icon {...p} icon="bell" />}
                right={() =>
                  unreadCount > 0 ? (
                    <Chip compact style={{ marginRight: 12 }}>
                      {unreadCount} new
                    </Chip>
                  ) : null
                }
              />
            </Card>
            <Card style={styles.action} onPress={gotoProfile}>
              <Card.Title
                title="Profile"
                left={(p) => <List.Icon {...p} icon="account" />}
              />
            </Card>
          </View>

          {/* Performance snapshot (clickable) */}
          <Surface
            elevation={1}
            style={[styles.card, { backgroundColor: theme.colors.surface }]}
          >
            <Button
              mode="text"
              onPress={gotoPerformance}
              contentStyle={{ justifyContent: "flex-start" }}
              icon="chart-areaspline"
            >
              View Performance
            </Button>

            <View style={styles.grid2}>
              <Card style={styles.metric}>
                <Card.Content>
                  <View style={styles.metricRow}>
                    <Text variant="titleSmall" style={styles.muted}>
                      Completed
                    </Text>
                    <List.Icon icon="check-circle" />
                  </View>
                  <Text
                    variant="headlineSmall"
                    style={{ fontWeight: "700" }}
                  >
                    {metrics?.completedBookings ?? 0}
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.metric}>
                <Card.Content>
                  <View style={styles.metricRow}>
                    <Text variant="titleSmall" style={styles.muted}>
                      Cancellations
                    </Text>
                    <List.Icon icon="close-circle" color={theme.colors.error} />
                  </View>
                  <Text
                    variant="headlineSmall"
                    style={{ fontWeight: "700" }}
                  >
                    {metrics?.cancellations ?? 0}
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.metric}>
                <Card.Content>
                  <View style={styles.metricRow}>
                    <Text variant="titleSmall" style={styles.muted}>
                      Avg. Rating
                    </Text>
                    <List.Icon icon="star" />
                  </View>
                  <Text
                    variant="headlineSmall"
                    style={{ fontWeight: "700" }}
                  >
                    {(metrics?.averageRating ?? 0).toFixed(1)}
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.metric}>
                <Card.Content>
                  <View style={styles.metricRow}>
                    <Text variant="titleSmall" style={styles.muted}>
                      Commission
                    </Text>
                    <List.Icon icon="currency-usd" />
                  </View>
                  <Text
                    variant="headlineSmall"
                    style={{ fontWeight: "700" }}
                  >
                    KSh {(metrics?.commissionEarned ?? 0).toLocaleString()}
                  </Text>
                </Card.Content>
              </Card>
            </View>
          </Surface>

          {/* Assigned Services */}
          <Surface
            elevation={1}
            style={[styles.card, { backgroundColor: theme.colors.surface }]}
          >
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium">Assigned services</Text>
              <Button mode="text" onPress={gotoSchedule}>
                Open Schedule
              </Button>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Chip
                selected={!selectedServiceId}
                onPress={() => setSelectedServiceId(null)}
                compact
              >
                All
              </Chip>
              {services.map((s) => (
                <Chip
                  key={s.id}
                  selected={selectedServiceId === s.id}
                  onPress={() =>
                    setSelectedServiceId((prev) => (prev === s.id ? null : s.id))
                  }
                  compact
                >
                  {s.name}
                </Chip>
              ))}
            </View>
          </Surface>

          {/* Bookings (filterable) */}
          <Surface
            elevation={1}
            style={[styles.card, { backgroundColor: theme.colors.surface }]}
          >
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium">Bookings</Text>
              <Button mode="text" onPress={gotoSchedule}>
                View all
              </Button>
            </View>

            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 8,
              }}
            >
              {STATUS_TABS.map((t) => (
                <Chip
                  key={t.key}
                  selected={statusKey === t.key}
                  onPress={() => setStatusKey(t.key)}
                  compact
                >
                  {t.label}
                  {typeof counts[t.key] === "number" ? ` • ${counts[t.key]}` : ""}
                </Chip>
              ))}
            </View>

            <Divider />

            {bookings.length === 0 ? (
              <Text
                style={{ marginTop: 12, color: theme.colors.onSurfaceVariant }}
              >
                No bookings found.
              </Text>
            ) : (
              bookings.map((b) => (
                <List.Item
                  key={b.id}
                  title={`${b.customer?.name ?? "Customer"} • ${
                    b.serviceName ?? "Service"
                  }`}
                  description={`${fmtTime(b.startTime)} – ${fmtTime(
                    b.endTime
                  )} ${
                    b.serviceDuration ? `• ${b.serviceDuration} min` : ""
                  }`}
                  right={() => (
                    <Chip compact style={{ alignSelf: "center" }}>
                      {b.status === "NO_SHOW"
                        ? "No-show"
                        : b.status.toLowerCase()}
                    </Chip>
                  )}
                />
              ))
            )}
          </Surface>
        </>
      )}
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

  loading: { alignItems: "center", paddingTop: 60 },

  row: { flexDirection: "row", gap: 12 },
  action: { flex: 1, margin: 4 },

  card: { marginHorizontal: 12, marginTop: 12, padding: 12, borderRadius: 12 },
  grid2: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metric: { flexBasis: "47%", flexGrow: 1 },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  muted: { color: "#6B7280" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
});
