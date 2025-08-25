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
  IconButton,
  List,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";

// ✅ Fixed import path - removed extra "mobile/" segment
import { staffApi } from "../../../../lib/api/modules/staff"
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
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<Array<{ id: string; name: string }>>([]);

  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [schedule, setSchedule] = useState<Appointment[]>([]);
  const [notes, setNotes] = useState<Notification[]>([]);

  // ✅ Fixed useEffect with Promise.allSettled and proper error handling
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        // 1) resolve business scope first
        const ctx = await staffApi.getStaffMe().catch(() => null);
        const initialBizId =
          ctx?.activeBusiness?.id || ctx?.businesses?.[0]?.id || null;

        if (!mounted) return;
        setBusinesses(ctx?.businesses || []);
        setBusinessId(initialBizId);

        // 2) load scoped data (never hang even if one call fails)
        const results = await Promise.allSettled([
          staffApi.getProfile({ businessId: initialBizId }),
          staffApi.getPerformanceMetrics({ businessId: initialBizId }),
          staffApi.getSchedule({ businessId: initialBizId }),
          staffApi.getNotifications({ businessId: initialBizId }),
        ]);

        if (!mounted) return;

        const [p, m, s, n] = results.map((r) =>
          r.status === "fulfilled" ? r.value : undefined
        );

        setProfile(p ?? null);
        setMetrics(m ?? { 
          completedBookings: 0, 
          cancellations: 0, 
          averageRating: null, 
          commissionEarned: 0, 
          totalRevenue: 0 
        });
        setSchedule(Array.isArray(s) ? s : []);
        setNotes(Array.isArray(n) ? n : []);
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

  // ✅ Business switching with Promise.allSettled
  const handleBusinessSwitch = async (businessId: string) => {
    setBusinessId(businessId);
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        staffApi.getProfile({ businessId }),
        staffApi.getPerformanceMetrics({ businessId }),
        staffApi.getSchedule({ businessId }),
        staffApi.getNotifications({ businessId }),
      ]);

      const [p, m, s, n] = results.map((r) =>
        r.status === "fulfilled" ? r.value : undefined
      );

      setProfile(p ?? null);
      setMetrics(m ?? { 
        completedBookings: 0, 
        cancellations: 0, 
        averageRating: null, 
        commissionEarned: 0, 
        totalRevenue: 0 
      });
      setSchedule(Array.isArray(s) ? s : []);
      setNotes(Array.isArray(n) ? n : []);
    } finally {
      setLoading(false);
    }
  };

  // Navigation to settings
  const navigateToSettings = () => {
    router.push("/settings" as any);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Header with Settings Button */}
      <View style={styles.headerRow}>
        <Text variant="headlineSmall" style={{ fontWeight: "700" }}>
          Staff Dashboard
        </Text>
        
        <View style={styles.headerActions}>
          {/* Business picker (chips) */}
          {businesses?.length > 1 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginRight: 8 }}>
              {businesses.map((b) => (
                <Chip
                  key={b.id}
                  compact
                  selected={businessId === b.id}
                  onPress={() => handleBusinessSwitch(b.id)}
                >
                  {b.name}
                </Chip>
              ))}
            </View>
          ) : null}
          
          {/* Settings Icon Button */}
          <IconButton
            icon="cog"
            size={24}
            onPress={navigateToSettings}
            style={{ margin: 0 }}
          />
        </View>
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
            <Card
              style={styles.action}
              onPress={() =>
                router.push({
                  pathname: "/business/dashboard/staff/profile",
                  params: { businessId: businessId || "" },
                } as any)
              }
            >
              <Card.Title
                title="Profile Settings"
                left={(p) => <List.Icon {...p} icon="account" />}
              />
            </Card>
            <Card
              style={styles.action}
              onPress={() =>
                router.push({
                  pathname: "/business/dashboard/staff/availability",
                  params: { businessId: businessId || "" },
                } as any)
              }
            >
              <Card.Title
                title="Availability & Time-off"
                left={(p) => <List.Icon {...p} icon="calendar-clock" />}
              />
            </Card>
            <Card
              style={styles.action}
              onPress={() =>
                router.push({
                  pathname: "/business/dashboard/staff/schedule",
                  params: { businessId: businessId || "" },
                } as any)
              }
            >
              <Card.Title
                title="My Schedule"
                left={(p) => <List.Icon {...p} icon="calendar" />}
              />
            </Card>
            <Card
              style={styles.action}
              onPress={() =>
                router.push({
                  pathname: "/business/dashboard/staff/performance",
                  params: { businessId: businessId || "" },
                } as any)
              }
            >
              <Card.Title
                title="Performance"
                left={(p) => <List.Icon {...p} icon="chart-line" />}
              />
            </Card>
            <Card
              style={styles.action}
              onPress={() =>
                router.push({
                  pathname: "/business/dashboard/staff/notifications",
                  params: { businessId: businessId || "" },
                } as any)
              }
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

          {/* Today's Schedule (preview) */}
          <Surface
            elevation={1}
            style={[styles.card, { backgroundColor: theme.colors.surface }]}
          >
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium">Today</Text>
              <Button
                mode="text"
                onPress={() =>
                  router.push({
                    pathname: "/business/dashboard/staff/schedule",
                    params: { businessId: businessId || "" },
                  } as any)
                }
              >
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
              <Button
                mode="text"
                onPress={() =>
                  router.push({
                    pathname: "/business/dashboard/staff/notifications",
                    params: { businessId: businessId || "" },
                  } as any)
                }
              >
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
                You're all caught up.
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
    flexWrap: "wrap",
    gap: 12,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
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