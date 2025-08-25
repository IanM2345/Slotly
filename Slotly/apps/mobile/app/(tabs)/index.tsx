// apps/mobile/app/(tabs)/index.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from "react-native";
import { Text, useTheme, ActivityIndicator } from "react-native-paper";
import { useRouter, useFocusEffect } from "expo-router";
import * as Location from "expo-location";

import SectionHeader from "../components/ui/SectionHeader";
import UICard from "../components/ui/Card";

import { useSession } from "../../context/SessionContext";
import { listBookings } from "../../lib/api/modules/users";
import { search as searchBusinesses } from "../../lib/api/modules/business";

// ---- Types ----
type SessionUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  role: string;
};

type BookingItemUI = {
  id: string;
  service: string;
  location: string;
  date: string;
  status: string;
  statusColor: string;
};

type BusinessItem = {
  id: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  distanceMeters?: number;
  logoUrl?: string;
};

// ---- Constants ----
const POLL_MS = 10_000; // 10 second polling for real-time feel
const NAIROBI_CENTER = { lat: -1.286389, lng: 36.817223 };

// ---- Helpers ----
const statusColorMap: Record<string, string> = {
  CONFIRMED: "#FACC15",
  PENDING: "#FACC15",
  COMPLETED: "#22c55e",
  CANCELLED: "#ef4444",
  RESCHEDULED: "#3b82f6",
  NO_SHOW: "#ef4444",
};

const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

const formatDateTime = (isoOrDate: string | Date) => {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const day = d.toLocaleDateString(undefined, { 
    month: "short", 
    day: "numeric", 
    year: "numeric" 
  });
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${day}, ${time}`;
};

function getInitials(name?: string | null, email?: string | null) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
  }
  if (email) return email[0]?.toUpperCase();
  return "U"; // Unknown user
}

// Normalize business results to ensure stable keys
const normalizeBusinesses = (arr: any[]): BusinessItem[] =>
  arr.map((b: any, i: number) => ({
    id: String(b.id ?? b._id ?? `biz-${b.name ?? "x"}-${i}`),
    name: b.name ?? "Business",
    address: b.address,
    latitude: b.latitude,
    longitude: b.longitude,
    distanceMeters: typeof b.distanceMeters === "number" ? b.distanceMeters : undefined,
    logoUrl: b.logoUrl,
  }));

const uniqById = <T extends { id: string }>(arr: T[]) =>
  Array.from(new Map(arr.map((x) => [x.id, x])).values());

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { token, user } = useSession() as { 
    token: string | null; 
    user: SessionUser | null;
  };

  const [refreshing, setRefreshing] = useState(false);

  // Profile initials from session
  const initials = useMemo(() => getInitials(user?.name, user?.email), [user]);

  // Recent bookings (live data)
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [recentBookings, setRecentBookings] = useState<BookingItemUI[]>([]);

  // Near you businesses (3 closest by distance)
  const [nearLoading, setNearLoading] = useState(true);
  const [nearYou, setNearYou] = useState<BusinessItem[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ----- Location handling with graceful fallback -----
  const requestLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("Location permission not granted, using fallback");
        setCoords(null);
        return;
      }
      
      const loc = await Location.getCurrentPositionAsync({ 
        accuracy: Location.Accuracy.Balanced
      });
      
      setCoords({ 
        lat: loc.coords.latitude, 
        lng: loc.coords.longitude 
      });
    } catch (error) {
      console.log("Error getting location:", error);
      setCoords(null);
    }
  }, []);

  // ----- Fetch recent bookings (live data) -----
  const fetchBookings = useCallback(async () => {
    if (!token) {
      setLoadingBookings(false);
      return;
    }
    
    try {
      setLoadingBookings(true);
      const data = await listBookings(token);
      
      // Combine upcoming and past bookings
      const all = [
        ...(Array.isArray(data?.upcomingBookings) ? data.upcomingBookings : []),
        ...(Array.isArray(data?.pastBookings) ? data.pastBookings : []),
      ];

      // Transform to UI format and get most recent 3
      const ui = all
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
        .slice(0, 3)
        .map((b: any) => {
          const status = String(b.status ?? "PENDING");
          return {
            id: String(b.id),
            service: b.service?.name ?? "Service",
            location: b.business?.name
              ? `${b.business.name}${b.business.address ? ", " + b.business.address : ""}`
              : b.business?.address ?? "—",
            date: formatDateTime(b.startTime),
            status,
            statusColor: statusColorMap[status] ?? theme.colors.primary,
          } as BookingItemUI;
        });

      setRecentBookings(ui);
    } catch (error) {
      console.log("Error fetching bookings:", error);
      setRecentBookings([]);
    } finally {
      setLoadingBookings(false);
    }
  }, [token, theme.colors.primary]);

  // ----- Fetch nearby businesses (3 closest by distance) -----
  const fetchNearYou = useCallback(async () => {
    try {
      setNearLoading(true);
      const base = coords ?? NAIROBI_CENTER;
      
      const res = await searchBusinesses({
        q: "",
        lat: base.lat,
        lng: base.lng,
        date: "",
        dayPart: "",
      });
      
      const raw = Array.isArray(res?.businesses) 
        ? res.businesses 
        : Array.isArray(res?.results) 
        ? res.results 
        : [];
        
      const items = uniqById(normalizeBusinesses(raw)).sort((a, b) => {
        const da = a.distanceMeters ?? Number.POSITIVE_INFINITY;
        const db = b.distanceMeters ?? Number.POSITIVE_INFINITY;
        return da - db;
      });
      
      // Show top 3 closest
      setNearYou(items.slice(0, 3));
    } catch (error) {
      console.log("Error fetching nearby businesses:", error);
      setNearYou([]);
    } finally {
      setNearLoading(false);
    }
  }, [coords]);

  // ----- Effects: Initial load -----
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  useEffect(() => {
    fetchBookings();
    fetchNearYou();
  }, [fetchBookings, fetchNearYou]);

  // Re-fetch nearby businesses when location is available
  useEffect(() => {
    if (coords) {
      fetchNearYou();
    }
  }, [coords, fetchNearYou]);

  // ----- Real-time polling while screen is focused -----
  useFocusEffect(
    useCallback(() => {
      // Fetch immediately on focus
      fetchBookings();
      
      // Start polling
      pollRef.current = setInterval(() => {
        fetchBookings();
      }, POLL_MS);
      
      // Cleanup on blur
      return () => {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      };
    }, [fetchBookings])
  );

  // ----- Pull to refresh -----
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchBookings(),
      fetchNearYou(),
    ]);
    setRefreshing(false);
  }, [fetchBookings, fetchNearYou]);

  // Quick actions (navigate to explore with pre-filled search)
  const quickActions = useMemo(
    () => [
      { id: "beauty", name: "Beauty", icon: "💅" },
      { id: "health", name: "Health", icon: "🏥" },
      { id: "fitness", name: "Fitness", icon: "🏋" },
      { id: "education", name: "Education", icon: "🎓" },
    ],
    []
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={onRefresh}
          colors={[theme.colors.primary]}
        />
      }
    >
      {/* Header with profile and notifications */}
      <View style={styles.header}>
        <Text variant="headlineMedium" style={{ 
          color: theme.colors.primary, 
          fontWeight: "bold" 
        }}>
          Slotly
        </Text>
        <View style={styles.headerRight}>
          <View style={[styles.notificationIcon, { backgroundColor: "#FACC15" }]}>
            <Text>🔔</Text>
          </View>
          {/* Tap to go to profile */}
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/profile" as any)}
            style={[styles.profileIcon, { backgroundColor: theme.colors.primary }]}
          >
            <Text style={{ 
              color: "white", 
              fontSize: 14, 
              fontWeight: "bold" 
            }}>
              {initials}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ height: 12 }} />

      {/* Hero Banner */}
      <UICard style={[styles.heroBanner, { backgroundColor: theme.colors.primary }]}>
        <View style={styles.heroContent}>
          <Text variant="headlineSmall" style={{ 
            color: "white", 
            fontWeight: "bold", 
            textAlign: "center" 
          }}>
            Book Your Next
          </Text>
          <Text variant="headlineSmall" style={{ 
            color: "white", 
            fontWeight: "bold", 
            textAlign: "center" 
          }}>
            Appointment Today!
          </Text>
        </View>
      </UICard>

      {/* Quick Actions */}
      <SectionHeader title="Quick Actions" />
      <View style={styles.quickActionsGrid}>
        {quickActions.map((action) => (
          <TouchableOpacity
            key={action.id}
            onPress={() => router.push({ 
              pathname: "/(tabs)/explore", 
              params: { q: action.name.toLowerCase() } 
            } as any)}
            style={{ width: "48%" }}
          >
            <UICard style={[styles.quickActionCard, { 
              borderColor: "#FACC15", 
              borderWidth: 2 
            }]}>
              <Text style={{ fontSize: 24, marginBottom: 8 }}>
                {action.icon}
              </Text>
              <Text variant="titleSmall" style={{ 
                color: theme.colors.primary, 
                fontWeight: "600" 
              }}>
                {action.name}
              </Text>
            </UICard>
          </TouchableOpacity>
        ))}
      </View>

      {/* Recent Bookings (Live Data) */}
      <SectionHeader 
        title="Recent Bookings" 
        actionLabel="View all" 
        onActionPress={() => router.push("/(tabs)/history" as any)} 
      />
      <View style={{ paddingHorizontal: 16 }}>
        {loadingBookings && recentBookings.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 16 }}>
            <ActivityIndicator />
            <Text style={{ 
              marginTop: 6, 
              color: theme.colors.onSurfaceVariant 
            }}>
              Loading your bookings…
            </Text>
          </View>
        ) : recentBookings.length === 0 ? (
          <Text style={{ 
            color: theme.colors.onSurfaceVariant, 
            paddingVertical: 8 
          }}>
            You have no recent bookings yet.
          </Text>
        ) : (
          recentBookings.map((booking) => (
            <TouchableOpacity 
              key={booking.id} 
              onPress={() => router.push("/(tabs)/history" as any)}
            >
              <UICard style={[styles.bookingCard, { 
                borderColor: theme.colors.primary, 
                borderWidth: 2 
              }]}>
                <View style={[styles.statusBadge, { 
                  backgroundColor: booking.statusColor 
                }]}>
                  <Text variant="bodySmall" style={{ 
                    color: theme.colors.primary, 
                    fontWeight: "600" 
                  }}>
                    {booking.status}
                  </Text>
                </View>
                <Text variant="titleMedium" style={{ 
                  color: theme.colors.primary, 
                  fontWeight: "600", 
                  marginBottom: 5 
                }}>
                  {booking.service}
                </Text>
                <Text variant="bodyMedium" style={{ 
                  color: "#666", 
                  marginBottom: 2 
                }}>
                  📍 {booking.location}
                </Text>
                <Text variant="bodyMedium" style={{ color: "#666" }}>
                  📅 {booking.date}
                </Text>
              </UICard>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Near You – 3 closest by distance */}
      <SectionHeader title="Near You" />
      {nearLoading && nearYou.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 12 }}>
          <ActivityIndicator />
          <Text style={{ 
            marginTop: 6, 
            color: theme.colors.onSurfaceVariant 
          }}>
            Finding businesses near you…
          </Text>
        </View>
      ) : nearYou.length === 0 ? (
        <Text style={{ 
          color: theme.colors.onSurfaceVariant, 
          paddingHorizontal: 16, 
          paddingBottom: 8 
        }}>
          No nearby businesses found.
        </Text>
      ) : (
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {nearYou.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => router.push({ 
                pathname: "/explore/explore-services", 
                params: { businessId: item.id } 
              } as any)}
            >
              <UICard style={[styles.nearYouCard, { 
                backgroundColor: "#f0f7ff",
                borderColor: theme.colors.primary,
                borderWidth: 1
              }]}>
                <View style={styles.nearYouContent}>
                  <Text variant="titleSmall" style={{ 
                    fontWeight: "700",
                    color: theme.colors.primary
                  }}>
                    {item.name}
                  </Text>
                  <Text variant="bodySmall" style={{ color: "#666" }}>
                    {typeof item.distanceMeters === "number" 
                      ? `${(item.distanceMeters / 1000).toFixed(1)} km away`
                      : item.address ?? "—"
                    }
                  </Text>
                </View>
              </UICard>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={{ height: 16 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  notificationIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  profileIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  heroBanner: {
    marginHorizontal: 16,
    marginVertical: 20,
    height: 100,
    borderRadius: 12,
    overflow: "hidden",
  },
  heroContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 20,
  },
  quickActionCard: {
    padding: 20,
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 12,
  },
  bookingCard: {
    padding: 15,
    marginBottom: 15,
    backgroundColor: "white",
    borderRadius: 12,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginBottom: 10,
  },
  nearYouCard: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "white",
  },
  nearYouContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});