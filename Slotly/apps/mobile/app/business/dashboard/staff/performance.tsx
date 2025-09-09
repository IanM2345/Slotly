// apps/mobile/app/business/dashboard/staff/performance.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View, Dimensions } from "react-native";
import {
  ActivityIndicator,
  Banner,
  Button,
  IconButton,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

// Same import depth as your staff/index.tsx
import { staffApi } from "../../../../lib/api/modules/staff";

// Victory (same style you use in analytics.tsx)
import Svg from "react-native-svg";
import {
  VictoryAxis,
  VictoryBar,
  VictoryChart,
  VictoryGroup,
  VictoryLabel,
  VictoryLegend,
  VictoryLine,
  VictoryTheme,
} from "victory-native";

type SeriesPoint = { x: string; y: number };

type PerfData = {
  completedBookings: number;
  cancellations: number;
  averageRating: number;
  commissionEarned: number;
  totalBookings?: number;
  totalRevenue?: number;
  performanceScore?: number;
  series: {
    bookings: SeriesPoint[];
    earnings: SeriesPoint[];
    cancellations: SeriesPoint[];
  };
  topServices: { serviceId: string; name: string; count: number }[];
};

const { width: SCREEN_W } = Dimensions.get("window");
const CHART_W = Math.max(320, SCREEN_W - 32); // some padding both sides

export default function StaffPerformanceScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { businessId: businessIdParam } = useLocalSearchParams<{ businessId?: string }>();
  const [businessId, setBusinessId] = useState<string | undefined>(
    typeof businessIdParam === "string" ? businessIdParam : undefined
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PerfData>({
    completedBookings: 0,
    cancellations: 0,
    averageRating: 0,
    commissionEarned: 0,
    series: { bookings: [], earnings: [], cancellations: [] },
    topServices: [],
  });

  // Resolve active business if query param not passed
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        let activeBizId = businessId;
        if (!activeBizId) {
          const me = await staffApi.getStaffMe().catch(() => null);
          activeBizId = me?.activeBusiness?.id || me?.businesses?.[0]?.id || undefined;
          if (mounted) setBusinessId(activeBizId);
        }

        const metrics = await staffApi.getPerformanceMetrics({ businessId: activeBizId });
        if (!mounted) return;

        setData({
          completedBookings: metrics.completedBookings,
          cancellations: metrics.cancellations,
          averageRating: metrics.averageRating,
          commissionEarned: metrics.commissionEarned,
          totalBookings: metrics.totalBookings,
          totalRevenue: metrics.totalRevenue,
          performanceScore: metrics.performanceScore,
          series: metrics.series,
          topServices: metrics.topServices,
        });
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load performance metrics");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [businessId]);

  const empty = useMemo(() => {
    const s = data.series;
    return !s.bookings?.length && !s.earnings?.length && !s.cancellations?.length;
  }, [data.series]);

  const bookingsVsCancelBars = useMemo(() => {
    const xKeys = Array.from(
      new Set([...(data.series.bookings || []), ...(data.series.cancellations || [])].map((d) => d.x))
    ).sort();
    const barsA = xKeys.map((x) => ({ x, y: (data.series.bookings || []).find((p) => p.x === x)?.y || 0 }));
    const barsB = xKeys.map((x) => ({ x, y: (data.series.cancellations || []).find((p) => p.x === x)?.y || 0 }));
    return { x: xKeys, a: barsA, b: barsB };
  }, [data.series]);

  const earningsLine = useMemo(() => data.series.earnings || [], [data.series]);

  const TopServiceRow = ({ name, count }: { name: string; count: number }) => (
    <View style={styles.topRow}>
      <Text style={[styles.topName, { color: theme.colors.onSurface }]}>{name}</Text>
      <Text style={{ color: theme.colors.onSurfaceVariant }}>{count}</Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <IconButton
            icon="arrow-left"
            size={24}
            onPress={() => router.back()}
            iconColor={theme.colors.onSurface}
          />
          <Text style={styles.title}>Performance</Text>
        </View>

        {/* Loading / Error */}
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator />
            <Text style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}>Loading…</Text>
          </View>
        ) : error ? (
          <Banner visible icon="alert" style={{ marginHorizontal: 16 }}>
            {error}
          </Banner>
        ) : (
          <>
            {/* Metric cards */}
            <View style={styles.metricsGrid}>
              <Metric
                title="Completed"
                value={String(data.completedBookings)}
                icon="check-circle"
                tint="#22c55e"
              />
              <Metric
                title="Cancellations"
                value={String(data.cancellations)}
                icon="close-circle"
                tint="#ef4444"
              />
              <Metric
                title="Avg. Rating"
                value={data.averageRating.toFixed(1)}
                icon="star"
                tint="#f59e0b"
              />
              <Metric
                title="Commission"
                value={`KSh ${Number(data.commissionEarned || 0).toLocaleString()}`}
                icon="currency-usd"
                tint="#16a34a"
              />
            </View>

            {/* Charts */}
            <Surface style={styles.card} elevation={2}>
              <Text style={styles.cardTitle}>Bookings vs Cancellations</Text>
              {bookingsVsCancelBars.x.length === 0 ? (
                <EmptyChart />
              ) : (
                <Svg width={CHART_W} height={260}>
                  <VictoryChart
                    width={CHART_W}
                    height={260}
                    standalone={false}
                    theme={VictoryTheme.material}
                    domainPadding={{ x: 28, y: 12 }}
                  >
                    <VictoryLegend
                      x={16}
                      y={0}
                      orientation="horizontal"
                      gutter={18}
                      data={[
                        { name: "Bookings", symbol: { type: "square" } },
                        { name: "Cancellations", symbol: { type: "square" } },
                      ]}
                    />
                    <VictoryAxis
                      tickFormat={(t: string) => String(t).slice(5)} // show MM
                      style={{ tickLabels: { angle: -30, fontSize: 9, padding: 18 } }}
                    />
                    <VictoryAxis dependentAxis />
                    <VictoryGroup offset={10}>
                      <VictoryBar
                        data={bookingsVsCancelBars.a}
                        labels={({ datum }: any) => (datum.y ? String(datum.y) : "")}
                        labelComponent={<VictoryLabel dy={-6} style={{ fontSize: 8 }} />}
                      />
                      <VictoryBar
                        data={bookingsVsCancelBars.b}
                        labels={({ datum }: any) => (datum.y ? String(datum.y) : "")}
                        labelComponent={<VictoryLabel dy={-6} style={{ fontSize: 8 }} />}
                      />
                    </VictoryGroup>
                  </VictoryChart>
                </Svg>
              )}
            </Surface>

            <Surface style={styles.card} elevation={2}>
              <Text style={styles.cardTitle}>Earnings (KES)</Text>
              {earningsLine.length === 0 ? (
                <EmptyChart />
              ) : (
                <Svg width={CHART_W} height={240}>
                  <VictoryChart
                    width={CHART_W}
                    height={240}
                    standalone={false}
                    theme={VictoryTheme.material}
                    domainPadding={{ x: 18, y: 12 }}
                  >
                    <VictoryAxis
                      tickFormat={(t: string) => String(t).slice(5)}
                      style={{ tickLabels: { angle: -30, fontSize: 9, padding: 18 } }}
                    />
                    <VictoryAxis
                      dependentAxis
                      tickFormat={(t: number) => (t >= 1000 ? `${Math.round(t / 1000)}k` : String(t))}
                    />
                    <VictoryLine
                      interpolation="monotoneX"
                      data={earningsLine}
                      labels={({ datum }: any) => (datum.y ? `KSh ${datum.y}` : "")}
                      labelComponent={<VictoryLabel dy={-8} style={{ fontSize: 9 }} />}
                    />
                  </VictoryChart>
                </Svg>
              )}
            </Surface>

            {/* Top Services */}
            <Surface style={styles.card} elevation={2}>
              <Text style={styles.cardTitle}>Top Services</Text>
              {data.topServices.length === 0 ? (
                <Text style={{ color: theme.colors.onSurfaceVariant }}>No completed bookings yet.</Text>
              ) : (
                <View style={{ marginTop: 8 }}>
                  {data.topServices.map((s) => (
                    <TopServiceRow key={s.serviceId} name={s.name} count={s.count} />
                  ))}
                </View>
              )}
            </Surface>

            {/* (Optional) Refresh */}
            <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28 }}>
              <Button mode="outlined" onPress={() => setBusinessId((id) => id /* re-trigger useEffect */)}>
                Refresh
              </Button>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({
  title,
  value,
  icon,
  tint,
}: {
  title: string;
  value: string | number;
  icon: string;
  tint: string;
}) {
  const theme = useTheme();
  return (
    <Surface style={styles.metric} elevation={1}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View>
          <Text style={{ color: theme.colors.onSurfaceVariant, marginBottom: 2 }}>{title}</Text>
          <Text style={{ fontSize: 20, fontWeight: "700", color: theme.colors.onSurface }}>{value}</Text>
        </View>
        <IconButton icon={icon} size={22} iconColor={tint} />
      </View>
    </Surface>
  );
}

function EmptyChart() {
  const theme = useTheme();
  return (
    <View style={{ height: 120, alignItems: "center", justifyContent: "center" }}>
      <IconButton icon="chart-line" size={28} iconColor={theme.colors.onSurfaceVariant} />
      <Text style={{ color: theme.colors.onSurfaceVariant }}>No data available</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 32 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 56,
    paddingBottom: 12,
  },
  title: { fontSize: 22, fontWeight: "700", marginLeft: 6 },
  loading: { alignItems: "center", paddingTop: 40, paddingBottom: 20 },

  metricsGrid: {
    paddingHorizontal: 16,
    paddingTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metric: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    width: (SCREEN_W - 16 * 2 - 12) / 2, // 2 columns with 12 gap
  },

  card: {
    marginTop: 16,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  cardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 10 },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  topName: { fontWeight: "600" },
});
