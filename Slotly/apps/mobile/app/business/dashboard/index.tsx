"use client";

import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Button, Card, Chip, Divider, Surface, Text, useTheme } from "react-native-paper";
 import { Link, type Href } from "expo-router";
import { dashboardApi } from "../../../lib/dashboard/api";
import type { DashboardMetrics, BookingPreview } from "../../../lib/dashboard/types";

export default function BusinessOverview() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const oneCol = width < 980;

  const [loading, setLoading] = useState(true);
  const [m, setM] = useState<DashboardMetrics | null>(null);
  const [upcoming, setUpcoming] = useState<BookingPreview[]>([]);

  useEffect(() => {
    (async () => {
      const [metrics, next] = await Promise.all([dashboardApi.getMetrics(), dashboardApi.getUpcoming(5)]);
      setM(metrics);
      setUpcoming(next);
      setLoading(false);
    })();
  }, []);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={styles.container}>
      <Text variant="headlineLarge" style={[styles.h1, { color: "#0F4BAC" }]}>Dashboard Overview</Text>

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
            <Surface
              key={b.id}
              elevation={0}
              style={styles.upcomingRow}
            >
              <Text style={styles.upcomingText}>{`${b.service} - ${b.customer}`}</Text>
              <Text style={styles.upcomingTime}>{b.time}</Text>
            </Surface>
          ))}
          {(!upcoming || upcoming.length === 0) && (
            <Text style={{ marginTop: 12, color: theme.colors.onSurfaceVariant }}>Nothing upcoming yet.</Text>
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

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
  h1: { fontWeight: "900", letterSpacing: 0.2, marginBottom: 8 },
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
    backgroundColor: "#FFE6C7", // soft orange pill to match wireframe
    borderRadius: 20,
    height: 36,
  },

  sectionCard: { borderRadius: 20, padding: 12, marginTop: 8 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },

  upcomingRow: {
    backgroundColor: "#FFF8E1", // pale yellow row
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
