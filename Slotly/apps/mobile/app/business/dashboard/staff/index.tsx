// apps/mobile/app/business/dashboard/staff/index.tsx
"use client";

import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Card,
  IconButton,
  List,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import { useSession } from "../../../../context/SessionContext";
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

type StaffMetrics = {
  completedBookings: number;
  cancellations: number;
  averageRating: number;
};

// Simple KPI Card Component
const Kpi = ({ title, value }: { title: string; value: string }) => {
  return (
    <Card style={styles.kpiCard}>
      <Card.Content>
        <Text variant="titleSmall" style={styles.muted}>
          {title}
        </Text>
        <Text variant="headlineSmall" style={{ fontWeight: "700", marginTop: 4 }}>
          {value}
        </Text>
      </Card.Content>
    </Card>
  );
};

// Booking Row Component
const BookingRow = ({ booking }: { booking: Booking }) => {
  const fmtTime = (d: string | Date) => {
    const date = typeof d === "string" ? new Date(d) : d;
    const hh = date.getHours().toString().padStart(2, "0");
    const mm = date.getMinutes().toString().padStart(2, "0");
    return `${hh}:${mm}`;
  };

  return (
    <List.Item
      title={`${booking.customer?.name ?? "Customer"} • ${booking.serviceName ?? "Service"}`}
      description={`${fmtTime(booking.startTime)} – ${fmtTime(booking.endTime)}${
        booking.serviceDuration ? ` • ${booking.serviceDuration} min` : ""
      }`}
      style={{ paddingVertical: 8 }}
    />
  );
};

export default function StaffDashboard() {
  const router = useRouter();
  const { token, user } = useSession();
  const theme = useTheme();
  const businessId = user?.business?.id || (user as any)?.businessId || undefined;

  const [metrics, setMetrics] = useState<StaffMetrics | null>(null);
  const [upcoming, setUpcoming] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const perf = await staffApi.getPerformanceMetrics({ token, businessId });
        const bookings = await staffApi.getSchedule({ token, businessId, upcoming: true });
        
        if (!mounted) return;
        
        setMetrics(perf);
        setUpcoming(Array.isArray(bookings) ? bookings.slice(0, 5) : []);
      } catch (e) {
        console.warn("Staff dashboard data failed:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { 
      mounted = false; 
    };
  }, [token, businessId]);

  const gotoSettings = () => router.replace("/settings");

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
          {/* Performance Metrics - Real Data Only */}
          {!loading && metrics && (
            <Surface
              elevation={1}
              style={[styles.card, { backgroundColor: theme.colors.surface }]}
            >
              <Text variant="titleMedium" style={{ marginBottom: 16 }}>
                Your Performance
              </Text>
              
              <View style={styles.metricsRow}>
                <Kpi title="Completed" value={String(metrics.completedBookings)} />
                <Kpi title="Cancellations" value={String(metrics.cancellations)} />
                <Kpi title="Avg rating" value={`${metrics.averageRating.toFixed(1)} ★`} />
              </View>
            </Surface>
          )}

          {/* Upcoming Bookings - Assigned to this staff */}
          <Surface
            elevation={1}
            style={[styles.card, { backgroundColor: theme.colors.surface }]}
          >
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium">Upcoming (assigned to you)</Text>
              <TouchableOpacity 
                onPress={() => router.push("/business/dashboard/bookings/manage" as any)}
              >
                <Text style={{ fontWeight: "600", color: theme.colors.primary }}>
                  View all
                </Text>
              </TouchableOpacity>
            </View>

            {upcoming.length === 0 ? (
              <Text style={{ marginTop: 8, opacity: 0.6 }}>
                No upcoming bookings
              </Text>
            ) : (
              <View style={{ marginTop: 8 }}>
                {upcoming.map((booking) => (
                  <BookingRow key={booking.id} booking={booking} />
                ))}
              </View>
            )}
          </Surface>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#F8FAFC" 
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
    color: "#1559C1" 
  },
  loading: { 
    alignItems: "center", 
    paddingTop: 60 
  },
  card: { 
    marginHorizontal: 12, 
    marginTop: 12, 
    padding: 16, 
    borderRadius: 12 
  },
  metricsRow: { 
    flexDirection: "row", 
    gap: 12 
  },
  kpiCard: { 
    flex: 1,
    minHeight: 80
  },
  muted: { 
    color: "#6B7280" 
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
});