"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { ScrollView, StyleSheet, View, RefreshControl, useWindowDimensions, Image } from "react-native";
import { Button, Card, Chip, Divider, IconButton, Surface, Text, useTheme } from "react-native-paper";
import { Link, type Href, useRouter } from "expo-router";
import { useSession } from "../../../context/SessionContext";

// ✅ manager client (uses axios with token interceptor)
import {
  getBusinessProfile as getManagerBusiness, // /api/manager/me
  getPerformance,                            // /api/manager/performance?start=&end=
  listBookings,                              // /api/manager/bookings
  getSubscription,                           // /api/manager/subscription
  listReviews,                               // /api/manager/reviews
  flagReview,                                // PATCH /api/manager/reviews?id=
} from "../../../lib/api/modules/manager";

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

/* ---------- Screen ---------- */
export default function BusinessOverview() {
  const theme = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const oneCol = width < 980;

  const { token, user } = useSession();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [upcoming, setUpcoming] = useState<BookingPreview[]>([]);
  
  // Additional state from first file
  const [billing, setBilling] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);

  // Get business logo from user context or profile
  const bizLogo = useMemo(() => {
    return (user?.business as any)?.logoUrl || 
           (user as any)?.business?.logoUrl || 
           profile?.logoUrl || 
           null;
  }, [user, profile]);

  const todayISO = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const fetchAll = useCallback(async () => {
    if (!token) {
      console.warn("[BusinessOverview] Missing auth token — skipping dashboard fetch.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // 1) Get profile first so we have the businessId
      const profileData = await getManagerBusiness();
      setProfile(profileData);
      const businessId =
        profileData?.id ??
        profileData?.business?.id ??
        profileData?.ownedBusinesses?.[0]?.id ??
        null;

      if (!businessId) {
        console.error("[BusinessOverview] No businessId found in profile:", profileData);
        setLoading(false);
        return;
      }

      // 2) ✅ UPDATED: Use getSubscription instead of getBilling
      const [perfRes, bookingsRes, subscriptionRes, reviewsRes] = await Promise.allSettled([
        getPerformance({ start: todayISO, end: todayISO }),   // KPIs for today
        listBookings({ businessId }),                         // ✅ pass businessId
        getSubscription(),                                    // ⬅️ use subscription route instead
        listReviews(),                                        // latest reviews
      ]);

      // ----- KPIs -----
      let bookingsToday = 0;
      let revenueTodayMinor = 0;
      let cancellationsToday = 0;
      let noShowsToday = 0;

      if (perfRes.status === "fulfilled" && perfRes.value) {
        // Expect either { analytics: { bookings: {YYYY-MM-DD}, revenue: {YYYY-MM-DD} } }
        // or any shape with today buckets — be defensive:
        const a = (perfRes.value as any).analytics ?? perfRes.value ?? {};
        const b = typeof a.bookings === "object" ? a.bookings : {};
        const r = typeof a.revenue === "object" ? a.revenue : {};
        bookingsToday = Number.isFinite(b[todayISO]) ? Number(b[todayISO]) : 0;
        revenueTodayMinor = Number.isFinite(r[todayISO]) ? Number(r[todayISO]) : 0;
      }
      const revenueTodayKES = Math.round(revenueTodayMinor / 100);

      // ----- Upcoming bookings (next 5) + cancellations/no-shows -----
      const nowMs = Date.now();
      if (bookingsRes.status === "fulfilled" && Array.isArray(bookingsRes.value)) {
        const safe = bookingsRes.value as any[];
        const nextFiveRaw = safe
          .filter(b => b?.startTime && new Date(b.startTime).getTime() >= nowMs)
          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
          .slice(0, 5);

        const fmt = (iso?: string) => {
          if (!iso) return "—";
          const d = new Date(iso);
          const hh = String(d.getHours()).padStart(2, "0");
          const mm = String(d.getMinutes()).padStart(2, "0");
          return `${hh}:${mm}`;
        };

        setUpcoming(
          nextFiveRaw.map(b => ({
            id: String(b?.id ?? ""),
            service: String(b?.service?.name ?? "—"),
            customer: String(b?.user?.name ?? b?.user?.email ?? "—"),
            time: fmt(b?.startTime),
            startTime: b?.startTime,
          }))
        );

        // Calculate same-day cancellations and no-shows
        const yyyy = new Date().getFullYear();
        const mm = new Date().getMonth() + 1;
        const dd = new Date().getDate();
        
        for (const b of safe) {
          if (!b?.startTime) continue;
          const bookingDate = new Date(b.startTime);
          if (bookingDate.getFullYear() === yyyy && 
              bookingDate.getMonth() + 1 === mm && 
              bookingDate.getDate() === dd) {
            const status = String(b?.status || "").toUpperCase();
            if (status === "CANCELLED") cancellationsToday++;
            if (status === "NO_SHOW") noShowsToday++;
          }
        }
      } else {
        setUpcoming([]);
        if (bookingsRes.status === "rejected") {
          console.error("Bookings fetch failed:", bookingsRes.reason);
        }
      }

      // ----- Billing (now via subscription + business.plan) -----
      const planFromBusiness =
        profileData?.plan ??
        profileData?.business?.plan ??
        profileData?.ownedBusinesses?.[0]?.plan ??
        null;

      const planLabelFromSlug = (slug?: string) => {
        if (!slug) return "Unknown";
        const s = String(slug);
        return s.startsWith("LEVEL_") ? `Level ${s.split("_")[1]}` : s;
      };

      if (subscriptionRes.status === "fulfilled") {
        const subscription = subscriptionRes.value as any;
        setBilling({
          plan: planFromBusiness,
          planLabel: planLabelFromSlug(planFromBusiness || ""),
          subscription,
          payments: [], // (optional) fill from another endpoint if you want recent payments here
        });
      } else {
        console.error("Subscription fetch failed:", (subscriptionRes as any).reason);
        setBilling({
          plan: planFromBusiness,
          planLabel: planLabelFromSlug(planFromBusiness || ""),
          subscription: null,
          payments: [],
        });
      }

      // ----- Reviews (latest) -----
      if (reviewsRes.status === "fulfilled" && Array.isArray(reviewsRes.value)) {
        setReviews((reviewsRes.value as any[]).slice(0, 3));
      } else {
        setReviews([]);
        if (reviewsRes.status === "rejected") {
          console.error("Reviews fetch failed:", reviewsRes.reason);
        }
      }

      setMetrics({
        bookingsToday,
        revenueTodayKES,
        bookingsChangePct: 0, // Could calculate from historical data
        revenueChangePct: 0,  // Could calculate from historical data
        cancellationsToday,
        cancellationsDelta: 0, // Could calculate from yesterday's data
        noShowsToday,
        noShowsDelta: 0, // Could calculate from yesterday's data
      });
    } catch (err) {
      console.warn("Dashboard fetch failed:", err);
      setMetrics({
        bookingsToday: 0,
        revenueTodayKES: 0,
        cancellationsToday: 0,
        noShowsToday: 0,
      });
      setUpcoming([]);
    } finally {
      setLoading(false);
    }
  }, [token, todayISO]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  // Navigation to settings
  const navigateToSettings = () => {
    router.push("/settings" as any);
  };

  return (
    <ScrollView 
      style={{ flex: 1, backgroundColor: theme.colors.background }} 
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      
      {/* Header with Back to Settings and Actions */}
      <View style={styles.headerRow}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <IconButton
            icon="arrow-left"
            size={24}
            onPress={() => router.replace("/settings")}  // always go to Settings
            style={{ margin: 0 }}
          />
          
          {/* Business Logo and Name Header */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginLeft: 8 }}>
            {bizLogo ? (
              <Image source={{ uri: bizLogo }} style={{ width: 48, height: 48, borderRadius: 24 }} />
            ) : (
              <Text style={{ fontSize: 28 }}>🏷️</Text>
            )}
            <View>
              <Text style={[styles.h1, { color: "#0F4BAC" }]}>
                {user?.business?.businessName || profile?.name || user?.name || "Your business"}
              </Text>
              {!!bizLogo && <Text style={{ color: "#6B7280" }}>Logo set</Text>}
            </View>
          </View>
        </View>

        <View style={{ flexDirection: "row" }}>
          <IconButton
            icon="refresh"
            size={24}
            onPress={onRefresh}
            style={{ margin: 0 }}
          />
          <IconButton
            icon="cog"
            size={24}
            onPress={navigateToSettings}
            style={{ margin: 0 }}
          />
        </View>
      </View>

      {/* METRICS */}
      <View style={[styles.metricsGrid, oneCol && { gap: 14 }]}>
        <MetricCard
          title="TODAY'S BOOKINGS"
          value={metrics?.bookingsToday ?? (loading ? "…" : 0)}
          tone="info"
          pill={`${sign(metrics?.bookingsChangePct)}% from yesterday`}
        />
        <MetricCard
          title="TODAY'S REVENUE"
          value={`KSh ${(metrics?.revenueTodayKES ?? 0).toLocaleString()}`}
          tone="info"
          pill={`${sign(metrics?.revenueChangePct)}% from yesterday`}
        />
        <MetricCard
          title="CANCELLATIONS"
          value={metrics?.cancellationsToday ?? (loading ? "…" : 0)}
          tone="danger"
          pill={`${delta(metrics?.cancellationsDelta)} from yesterday`}
        />
        <MetricCard
          title="NO SHOWS"
          value={metrics?.noShowsToday ?? (loading ? "…" : 0)}
          tone="success"
          pill={`${delta(metrics?.noShowsDelta)} from yesterday`}
        />
      </View>

      {/* QUICK LINKS - REMOVED COUPONS AND BILLING */}
      <View style={styles.quickLinks}>
        <QuickLink href="/business/dashboard/analytics" label="Analytics" icon="chart-box" />
        <QuickLink href="/business/dashboard/team" label="Staff" icon="account-group" />
        <QuickLink href="/business/dashboard/bookings/manage" label="Bookings" icon="calendar" />
        <QuickLink href="/business/dashboard/services" label="Services" icon="briefcase" />
        <QuickLink href="/business/dashboard/reports" label="Reports" icon="file-chart" />
        <QuickLink href="/business/dashboard/profile" label="Profile" icon="store" />
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
          {(!upcoming || upcoming.length === 0) && !loading && (
            <Text style={{ marginTop: 12, color: theme.colors.onSurfaceVariant }}>
              No bookings have been made yet.
            </Text>
          )}
        </View>
      </Surface>

      {/* Business Profile Section */}
      <Surface elevation={1} style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
        <Text variant="titleLarge" style={{ fontWeight: "800", color: "#0F4BAC" }}>Business Profile</Text>
        <Divider style={{ marginVertical: 8 }} />
        {profile ? (
          <>
            <Text>Name: <Text style={styles.bold}>{profile?.name}</Text></Text>
            {!!profile?.type && <Text>Type: {profile.type}</Text>}
            {!!profile?.address && <Text>Address: {profile.address}</Text>}
            {!!profile?.createdAt && <Text>Since: {new Date(profile.createdAt).toDateString()}</Text>}
            <View style={{ marginTop: 8 }}>
              <Button mode="outlined" onPress={() => router.push("/business/dashboard/profile")}>
                Edit Profile
              </Button>
            </View>
          </>
        ) : (
          <Text>{loading ? "Loading…" : "No profile data"}</Text>
        )}
      </Surface>

      {/* Reviews Section */}
      <Surface elevation={1} style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.sectionHeader}>
          <Text variant="titleLarge" style={{ fontWeight: "800", color: "#0F4BAC" }}>Recent Reviews</Text>
          <Button onPress={() => router.push("/business/dashboard/reviews")}>View all</Button>
        </View>
        <Divider />
        <View style={{ paddingVertical: 8 }}>
          {!reviews.length && !loading ? (
            <Text style={{ marginTop: 12, color: theme.colors.onSurfaceVariant }}>No reviews yet.</Text>
          ) : (
            reviews.map((r: any) => (
              <View key={r.id} style={styles.reviewRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bold}>{r?.user?.name || "Anonymous"}</Text>
                  <Text>{"★".repeat(Number(r?.rating || 0))}</Text>
                  {!!r?.comment && <Text>{r.comment}</Text>}
                  <Text style={{ opacity: 0.6, marginTop: 2 }}>
                    {new Date(r.createdAt).toDateString()}
                  </Text>
                </View>
                {!!r?.flagged ? (
                  <Chip compact>Flagged</Chip>
                ) : (
                  <Button
                    mode="text"
                    onPress={async () => {
                      try {
                        await flagReview(r.id);
                        onRefresh();
                      } catch {}
                    }}
                  >
                    Flag
                  </Button>
                )}
              </View>
            ))
          )}
        </View>
      </Surface>
    </ScrollView>
  );
}

/* ---------- Components ---------- */

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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  h1: { fontWeight: "900", letterSpacing: 0.2, fontSize: 24 },
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

  reviewRow: { 
    flexDirection: "row", 
    alignItems: "flex-start", 
    justifyContent: "space-between", 
    paddingVertical: 10, 
    gap: 8 
  },
  bold: { fontWeight: "700" },
});