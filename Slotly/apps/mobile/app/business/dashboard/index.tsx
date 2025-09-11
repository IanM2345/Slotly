"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { ScrollView, StyleSheet, View, RefreshControl, useWindowDimensions, Image } from "react-native";
import { Button, Card, Chip, Divider, IconButton, Surface, Text, useTheme } from "react-native-paper";
import { Link, type Href, useRouter } from "expo-router";
import { useSession } from "../../../context/SessionContext";

// ✅ manager client (uses axios with token interceptor)
import {
  getBusinessProfile as getManagerBusiness, // /api/manager/me
  getAnalytics,                              // /api/manager/analytics (NEW)
  listBookings,                              // /api/manager/bookings
  getSubscription,                           // /api/manager/subscription
  listReviews,                               // /api/manager/reviews
  flagReview,                                // PATCH /api/manager/reviews?id=
} from "../../../lib/api/modules/manager";

/* ---------- Local types ---------- */
type DashboardMetrics = {
  totalBookings: number;
  completed: number;
  cancelled: number;
  noShow: number;
  revenueMinor: number;
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
  const [kpis, setKpis] = useState<DashboardMetrics | null>(null);
  const [upcoming, setUpcoming] = useState<BookingPreview[]>([]);
  
  // Additional state from first file
  const [billing, setBilling] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

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
    
    let mounted = true;
    
    try {
      setLoading(true);
      setError(null);

      // 1) Get 30-day analytics for KPI cards
      const { kpis } = await getAnalytics(undefined, { period: "30d" });
      if (!mounted) return;

      setKpis({
        totalBookings: kpis.totalBookings,
        completed: kpis.completed,
        cancelled: kpis.cancelled,
        noShow: kpis.noShow,
        revenueMinor: kpis.revenueMinor,
      });

      // 2) Get profile first so we have the businessId
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

      // 3) Get additional data
      const [bookingsRes, subscriptionRes, reviewsRes] = await Promise.allSettled([
        listBookings({ businessId }),                         // ✅ pass businessId
        getSubscription(),                                    // ⬅️ use subscription route instead
        listReviews(),                                        // latest reviews
      ]);

      // ----- Upcoming bookings (next 5) -----
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
    } catch (e: any) {
      if (!mounted) return;
      setError(e?.message || "Failed to load dashboard");
    } finally {
      if (mounted) setLoading(false);
    }
    
    return () => { mounted = false; };
  }, [token]);

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

      {loading && !kpis ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      ) : error ? (
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.error }]}>{error}</Text>
          <Button onPress={fetchAll} style={{ marginTop: 12 }}>
            Retry
          </Button>
        </View>
      ) : (
        <>
          {/* METRICS */}
          <View style={[styles.metricsGrid, oneCol && { gap: 14 }]}>
            <MetricCard
              title="TOTAL BOOKINGS"
              value={kpis?.totalBookings ?? 0}
              tone="info"
              pill="Last 30 days"
            />
            <MetricCard
              title="REVENUE (KES)"
              value={`${((kpis?.revenueMinor ?? 0) / 100).toLocaleString()}`}
              tone="info"
              pill="Last 30 days"
            />
            <MetricCard
              title="CANCELLATIONS"
              value={kpis?.cancelled ?? 0}
              tone="danger"
              pill="Last 30 days"
            />
            <MetricCard
              title="NO SHOWS"
              value={kpis?.noShow ?? 0}
              tone="success"
              pill="Last 30 days"
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
        </>
      )}
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

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6B7280",
  },
});