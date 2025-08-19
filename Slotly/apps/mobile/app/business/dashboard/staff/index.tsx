// apps/mobile/app/business/dashboard/staff/index.tsx
"use client";
import type { RelativePathString } from "expo-router";

import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Divider,
  List,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";

import { staffApi } from "../../../../lib/staff/api";
import type {
  StaffProfile,
  PerformanceMetrics,
  Appointment,
  Notification,
} from "../../../../lib/staff/types";

export default function StaffHubScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [schedule, setSchedule] = useState<Appointment[]>([]);
  const [notes, setNotes] = useState<Notification[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [p, m, s, n] = await Promise.all([
          staffApi.getProfile(),
          staffApi.getPerformanceMetrics(),
          staffApi.getSchedule(),
          staffApi.getNotifications(),
        ]);
        if (!mounted) return;
        setProfile(p);
        setMetrics(m);
        setSchedule(s);
        setNotes(n);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const unreadCount = useMemo(
    () => notes.filter((n) => !n.isRead).length,
    [notes]
  );

  const statusColor = (status: Appointment["status"]) => {
    switch (status) {
      case "confirmed":
        return theme.colors.primary; // blue
      case "pending":
        return "#FBC02D"; // yellow
      case "completed":
        return "#2E7D32"; // green
      case "cancelled":
      default:
        return theme.colors.error; // red
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <Text variant="headlineSmall" style={{ fontWeight: "700" }}>
          Staff Dashboard
        </Text>
        <Button
          mode="contained"
          buttonColor="#FBC02D"
          textColor={theme.colors.onPrimary}
         onPress={() => router.push("/business/dashboard/staff/register" as RelativePathString)}

        >
          Register
        </Button>
      </View>

      {loading ? (
        <View style={{ paddingVertical: 40, alignItems: "center" }}>
          <ActivityIndicator />
        </View>
      ) : (
        <>
          {/* Welcome / Quick info */}
          <Surface
            elevation={1}
            style={[styles.card, { backgroundColor: theme.colors.surface }]}
          >
            <Text variant="titleMedium" style={{ marginBottom: 4 }}>
              Welcome{profile?.firstName ? `, ${profile.firstName}` : ""} 👋
            </Text>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>
              Manage your profile, schedule, availability, and see performance
              at a glance.
            </Text>
          </Surface>

          {/* Quick Actions */}
          <View style={styles.grid2}>
            <Card style={styles.action}onPress={() => router.push("/business/dashboard/staff/profile" as RelativePathString)}>
              <Card.Title
                title="Profile Settings"
                left={(p) => <List.Icon {...p} icon="account" />}
              />
            </Card>
            <Card
              style={styles.action}
              onPress={() => router.push("/business/dashboard/staff/availability" as RelativePathString)}

            >
              <Card.Title
                title="Availability & Time-off"
                left={(p) => <List.Icon {...p} icon="calendar-clock" />}
              />
            </Card>
            <Card style={styles.action} onPress={() => router.push("schedule" as RelativePathString)}>
              <Card.Title
                title="My Schedule"
                left={(p) => <List.Icon {...p} icon="calendar" />}
              />
            </Card>
            <Card
              style={styles.action}
              onPress={() => router.push("/business/dashboard/staff/performance" as RelativePathString)}
            >
              <Card.Title
                title="Performance"
                left={(p) => <List.Icon {...p} icon="chart-line" />}
              />
            </Card>
            <Card
              style={styles.action}
              onPress={() => router.push("/business/dashboard/staff/notifications" as RelativePathString)}
            >
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
          </View>

          {/* At a Glance Metrics */}
          <Surface
            elevation={1}
            style={[styles.card, { backgroundColor: theme.colors.surface }]}
          >
            <Text variant="titleMedium" style={{ marginBottom: 8 }}>
              Performance (at a glance)
            </Text>
            <View style={styles.grid2}>
              <Card style={styles.metric}>
                <Card.Content>
                  <View style={styles.metricRow}>
                    <Text variant="titleSmall" style={styles.muted}>
                      Completed
                    </Text>
                    <List.Icon icon="target" />
                  </View>
                  <Text variant="headlineSmall" style={{ fontWeight: "700" }}>
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
                  <Text variant="headlineSmall" style={{ fontWeight: "700" }}>
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
                  <Text variant="headlineSmall" style={{ fontWeight: "700" }}>
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
                  <Text variant="headlineSmall" style={{ fontWeight: "700" }}>
                    KSh {(metrics?.commissionEarned ?? 0).toLocaleString()}
                  </Text>
                </Card.Content>
              </Card>
            </View>
          </Surface>

          {/* Today’s Schedule (preview) */}
          <Surface
            elevation={1}
            style={[styles.card, { backgroundColor: theme.colors.surface }]}
          >
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium">Today</Text>
              <Button mode="text" onPress={() => router.push("/business/dashboard/staff/schedule" as RelativePathString)}>
                View all
              </Button>
            </View>
            <Divider />
            {schedule.slice(0, 4).map((item) => (
              <List.Item
                key={item.id}
                title={item.clientName}
               description={`${item.service} • ${item.duration}`}
                left={() => (
                  <View
                    style={{
                      width: 72,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontWeight: "700" }}>{item.time}</Text>
                  </View>
                )}
                right={() => (
                  <Chip
                    compact
                    style={{
                      alignSelf: "center",
                      backgroundColor: statusColor(item.status),
                    }}
                    textStyle={{ color: "#fff" }}
                  >
                    {item.status}
                  </Chip>
                )}
              />
            ))}
            {schedule.length === 0 && (
              <Text style={{ marginTop: 12, color: theme.colors.onSurfaceVariant }}>
                No appointments scheduled.
              </Text>
            )}
          </Surface>

          {/* Notifications (preview) */}
          <Surface
            elevation={1}
            style={[styles.card, { backgroundColor: theme.colors.surface }]}
          >
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium">Notifications</Text>
              <Button mode="text" onPress={() => router.push("/business/dashboard/staff/notifications" as RelativePathString)}>
                Open
              </Button>
            </View>
            <Divider />
            {notes.slice(0, 3).map((n) => (
              <List.Item
                key={n.id}
                title={n.title}
                left={(p) => (
                  <List.Icon {...p} icon={n.isRead ? "bell-outline" : "bell"} />
                )}
              />
            ))}
            {notes.length === 0 && (
              <Text style={{ marginTop: 12, color: theme.colors.onSurfaceVariant }}>
                You’re all caught up.
              </Text>
            )}
          </Surface>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  card: { borderRadius: 20, padding: 12 },
  grid2: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  action: { flexBasis: "48%", borderRadius: 16 },
  metric: { flexBasis: "48%", borderRadius: 16 },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  muted: { color: "#6b7280" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
});
