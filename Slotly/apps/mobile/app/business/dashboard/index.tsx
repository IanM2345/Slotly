"use client";

import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Button, Card, Chip, Divider, IconButton, Surface, Text, useTheme } from "react-native-paper";
import { Link, type Href, useRouter } from "expo-router";
import { useSession } from "../../../context/SessionContext";

/* ---------- Local types ---------- */
type DashboardMetrics = {
  bookingsToday: number;
  revenueTodayKES: number;
  bookingsChangePct?: number;
  revenueChangePct?: number;
  cancellationsToday: number;
  cancellationsDelta?: number;
  noShowsToday: number;
  noShowsDelta?: number;
};

type BookingPreview = {
  id: string;
  service: string;
  customer: string;
  time: string;
  startTime?: string;
};

/* ---------- Config ---------- */
const API_BASE =
  (typeof process !== "undefined" && (process as any).env?.EXPO_PUBLIC_API_BASE_URL) || "";

/* ---------- Strict fetchers: token REQUIRED ---------- */
async function fetchJSON<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const url = API_BASE ? `${API_BASE}${path}` : path;
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(init.headers as Record<string, string>),
    Authorization: `Bearer ${token}`,
  };

  const res = await fetch(url, {
    method: init.method || "GET",
    headers,
    ...(init.body ? { body: init.body } : {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err: any = new Error(`${init.method || "GET"} ${path} ${res.status}: ${text || res.statusText}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function fetchAnalyticsDaily(token: string, startISO: string, endISO: string) {
  const qs = new URLSearchParams({
    view: "daily",
    startDate: startISO,
    endDate: endISO,
    metrics: "bookings,revenue",
  }).toString();
  return fetchJSON<any>(`/api/manager/analytics?${qs}`, token);
}

async function fetchBookings(token: string) {
  return fetchJSON<any[]>(`/api/manager/bookings`, token);
}

/* ---------- Screen ---------- */
export default function BusinessOverview() {
  const theme = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const oneCol = width < 980;

  const { token } = useSession(); // token: string | null

  const [loading, setLoading] = useState(true);
  const [m, setM] = useState<DashboardMetrics | null>(null);
  const [upcoming, setUpcoming] = useState<BookingPreview[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Require token: if not present, do nothing (avoids unauth loops).
      if (!token) {
        // Optional: dev hint
        console.warn("[BusinessOverview] Missing auth token — skipping dashboard fetch.");
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // ----- today YYYY-MM-DD -----
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, "0");
        const dd = String(today.getDate()).padStart(2, "0");
        const todayISO = `${yyyy}-${mm}-${dd}`;

        // 1) KPIs via analytics
        let bookingsToday = 0;
        let revenueTodayMinor = 0;

        try {
          const res = await fetchAnalyticsDaily(token, todayISO, todayISO);
          const a = res?.analytics ?? {};
          const bkt = a?.bookings && typeof a.bookings === "object" ? a.bookings : {};
          const rvt = a?.revenue && typeof a.revenue === "object" ? a.revenue : {};
          bookingsToday = Number.isFinite(bkt[todayISO]) ? Number(bkt[todayISO]) : 0;
          revenueTodayMinor = Number.isFinite(rvt[todayISO]) ? Number(rvt[todayISO]) : 0;
        } catch {
          // 401/403/etc → soft empty
          bookingsToday = 0;
          revenueTodayMinor = 0;
        }

        // 2) Upcoming + derived cancels/no-shows
        let nextFive: BookingPreview[] = [];
        let cancellationsToday = 0;
        let noShowsToday = 0;

        try {
          const list = await fetchBookings(token);
          const now = Date.now();
          const safe = Array.isArray(list) ? list : [];

          const upcomingRaw = safe
            .filter((b: any) => b?.startTime && new Date(b.startTime).getTime() >= now)
            .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
            .slice(0, 5);

          nextFive = upcomingRaw.map((b: any) => ({
            id: String(b?.id ?? ""),
            service: String(b?.service?.name ?? "—"),
            customer: String(b?.user?.name ?? b?.user?.email ?? "—"),
            time: formatTime(b?.startTime),
            startTime: b?.startTime,
          }));

          const isSameDay = (iso?: string) => {
            if (!iso) return false;
            const d = new Date(iso);
            return d.getFullYear() === yyyy && d.getMonth() + 1 === Number(mm) && d.getDate() === Number(dd);
          };

          for (const b of safe) {
            if (!isSameDay(b?.startTime)) continue;
            const status = String(b?.status || "").toUpperCase();
            if (status === "CANCELLED") cancellationsToday++;
            if (status === "NO_SHOW") noShowsToday++;
          }
        } catch {
          nextFive = [];
          cancellationsToday = 0;
          noShowsToday = 0;
        }

        const revenueTodayKES = Math.round(revenueTodayMinor / 100);

        if (!cancelled) {
          setM({
            bookingsToday,
            revenueTodayKES,
            bookingsChangePct: 0,
            revenueChangePct: 0,
            cancellationsToday,
            cancellationsDelta: 0,
            noShowsToday,
            noShowsDelta: 0,
          });
          setUpcoming(nextFive);
        }
      } catch {
        if (!cancelled) {
          setM({
            bookingsToday: 0,
            revenueTodayKES: 0,
            cancellationsToday: 0,
            noShowsToday: 0,
          });
          setUpcoming([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]); // token is REQUIRED; effect runs only when it's available

  // Navigation to settings
  const navigateToSettings = () => {
    router.push("/settings" as any);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={styles.container}>
      
      {/* Header with Settings Navigation */}
      <View style={styles.headerRow}>
        <Text variant="headlineLarge" style={[styles.h1, { color: "#0F4BAC" }]}>
          Dashboard Overview
        </Text>
        <IconButton
          icon="cog"
          size={24}
          onPress={navigateToSettings}
          style={{ margin: 0 }}
        />
      </View>

      {/* METRICS */}
      <View style={[styles.metricsGrid, oneCol && { gap: 14 }]}>
        <MetricCard
          title="TODAY'S BOOKINGS"
          value={m?.bookingsToday ?? 0}
          tone="info"
          pill={`${sign(m?.bookingsChangePct)}% from yesterday`}
        />
        <MetricCard
          title="TODAY'S REVENUE"
          value={`KSh ${(m?.revenueTodayKES ?? 0).toLocaleString()}`}
          tone="info"
          pill={`${sign(m?.revenueChangePct)}% from yesterday`}
        />
        <MetricCard
          title="CANCELLATIONS"
          value={m?.cancellationsToday ?? 0}
          tone="danger"
          pill={`${delta(m?.cancellationsDelta)} from yesterday`}
        />
        <MetricCard
          title="NO SHOWS"
          value={m?.noShowsToday ?? 0}
          tone="success"
          pill={`${delta(m?.noShowsDelta)} from yesterday`}
        />
      </View>

      {/* QUICK LINKS */}
      <View style={styles.quickLinks}>
        <QuickLink href="/business/dashboard/analytics" label="Analytics" icon="chart-box" />
        <QuickLink href="/business/dashboard/team" label="Staff" icon="account-group" />
        <QuickLink href="/business/dashboard/bookings/manage" label="Bookings" icon="calendar" />
        <QuickLink href="/business/dashboard/services" label="Services" icon="briefcase" />
        <QuickLink href="/business/dashboard/coupons" label="Coupons" icon="ticket-percent" />
        <QuickLink href="/business/dashboard/reports" label="Reports" icon="file-chart" />
        <QuickLink href="/business/dashboard/billing" label="Billing" icon="credit-card" />
      </View>

      {/* UPCOMING LIST */}
      <Surface elevation={1} style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.sectionHeader}>
          <Text variant="titleLarge" style={{ fontWeight: "800", color: "#0F4BAC" }}>Next 5 Upcoming Bookings</Text>
          <Link href="./bookings/manage" asChild><Button mode="text">View all</Button></Link>
        </View>
        <Divider />
        <View style={{ paddingVertical: 8 }}>
          {upcoming.map((b) => (
            <Surface key={b.id} elevation={0} style={styles.upcomingRow}>
              <Text style={styles.upcomingText}>{`${b.service} - ${b.customer}`}</Text>
              <Text style={styles.upcomingTime}>{b.time}</Text>
            </Surface>
          ))}
          {(!upcoming || upcoming.length === 0) && (
            <Text style={{ marginTop: 12, color: theme.colors.onSurfaceVariant }}>
              No bookings have been made yet.
            </Text>
          )}
        </View>
      </Surface>
    </ScrollView>
  );
}

/* ---------- Pieces ---------- */

function MetricCard(props: { title: string; value: string | number; pill: string; tone: "info" | "success" | "danger" }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const oneCol = width < 980;

  const edge = "#F57C00"; // orange accent
  const pillBg =
    props.tone === "danger" ? "rgba(198,40,40,0.10)" : props.tone === "success" ? "rgba(46,125,50,0.10)" : "rgba(15,75,172,0.10)";
  const pillFg =
    props.tone === "danger" ? "#C62828" : props.tone === "success" ? "#2E7D32" : "#0F4BAC";

  return (
    <Card style={[styles.metricCard, oneCol && { flexBasis: "100%" }]} mode="elevated">
      <View style={[styles.edge, { backgroundColor: edge }]} />
      <Card.Content style={{ paddingVertical: 18 }}>
        <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant, letterSpacing: 0.2 }}>
          {props.title}
        </Text>
        <Text
          style={{
            fontSize: 42,
            lineHeight: 48,
            fontWeight: "900",
            color: props.tone === "info" ? "#0F4BAC" : theme.colors.onSurface,
            marginTop: 6,
            marginBottom: 8,
          }}
        >
          {props.value}
        </Text>
        <Chip compact style={[styles.pill, { backgroundColor: pillBg }]}>
          <Text style={{ color: pillFg }}>{props.pill}</Text>
        </Chip>
      </Card.Content>
    </Card>
  );
}

function QuickLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link href={href as Href} asChild>
      <Chip icon={icon} style={styles.quickChip} textStyle={{ fontWeight: "600" }}>
        {label}
      </Chip>
    </Link>
  );
}

/* ---------- Helpers ---------- */
const sign = (n?: number) => (n == null ? "0" : n > 0 ? `+${n}` : `${n}`);
const delta = (n?: number) => (n == null ? "0" : n > 0 ? `+${n}` : `${n}`);

function formatTime(iso?: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  } catch {
    return "—";
  }
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  h1: { fontWeight: "900", letterSpacing: 0.2 },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  metricCard: {
    flexBasis: "48%",
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  edge: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 8,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  pill: { alignSelf: "flex-start" },

  quickLinks: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
    marginBottom: 6,
  },
  quickChip: {
    backgroundColor: "#FFE6C7",
    borderRadius: 20,
    height: 36,
  },

  sectionCard: { borderRadius: 20, padding: 12, marginTop: 8 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },

  upcomingRow: {
    backgroundColor: "#FFF8E1",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  upcomingText: { fontSize: 16, fontWeight: "600", color: "#233044" },
  upcomingTime: { fontSize: 14, fontWeight: "800", color: "#0F4BAC" },
});