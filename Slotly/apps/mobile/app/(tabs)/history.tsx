// apps/mobile/app/(tabs)/history.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, ScrollView, Alert, RefreshControl } from "react-native";
import { Text, useTheme, ActivityIndicator } from "react-native-paper";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import * as Linking from "expo-linking";

import UICard from "../components/ui/Card";
import Pill from "../components/ui/Pill";
import ActionButton from "../components/ui/ActionButton";

import { listBookings, cancelBooking } from "../../lib/api/modules/users";
import { useSession } from "../../context/SessionContext";

type ApiBooking = {
  id: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "RESCHEDULED" | "NO_SHOW";
  startTime: string; // ISO
  endTime?: string;  // ISO
  service?: { id: string; name: string; duration?: number; price?: number; imageUrl?: string };
  business?: { id: string; name: string; address?: string };
  staff?: { id: string; name?: string };
};

type Item = {
  id: string;
  raw: ApiBooking;
  labelStatus: "Upcoming" | "Finished" | "Cancelled";
  service: string;
  staff: string;
  business: string;
  date: string;
  time: string;
};

function fmtDate(d: Date) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function toItem(bk: ApiBooking): Item {
  const start = new Date(bk.startTime);
  const now = new Date();
  const upcomingByTime = start.getTime() > now.getTime();
  const labelStatus: Item["labelStatus"] =
    bk.status === "CANCELLED" ? "Cancelled"
    : (bk.status === "COMPLETED" || bk.status === "NO_SHOW") ? "Finished"
    : upcomingByTime ? "Upcoming" : "Finished";

  return {
    id: bk.id,
    raw: bk,
    labelStatus,
    service: bk.service?.name || "Service",
    staff: bk.staff?.name || "Any staff",
    business: bk.business?.name || "Business",
    date: fmtDate(start),
    time: fmtTime(start),
  };
}

export default function HistoryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { token } = useSession();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<Item[]>([]);

  const load = useCallback(async () => {
    if (!token) {
      console.warn("No token available for fetching bookings");
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await listBookings(token);

      // API response shape: { upcomingBookings, pastBookings }
      const rows: ApiBooking[] = [
        ...(Array.isArray(data?.upcomingBookings) ? data.upcomingBookings : []),
        ...(Array.isArray(data?.pastBookings) ? data.pastBookings : []),
      ];

      const mapped = rows.map(toItem);

      // Split & sort (based on *current time* classification)
      const upcoming = mapped
        .filter((i) => i.labelStatus === "Upcoming")
        .sort((a, b) => new Date(a.raw.startTime).getTime() - new Date(b.raw.startTime).getTime());

      const past = mapped
        .filter((i) => i.labelStatus !== "Upcoming")
        .sort((a, b) => new Date(b.raw.startTime).getTime() - new Date(a.raw.startTime).getTime());

      setItems([...upcoming, ...past]);
    } catch (e: any) {
      console.error("Failed to load bookings:", e);
      Alert.alert("Failed to load bookings", e?.message || "Please try again.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      // Refetch whenever the tab/screen regains focus
      load();
    }, [load])
  );

  const upcoming = useMemo(() => items.filter((i) => i.labelStatus === "Upcoming"), [items]);
  const past = useMemo(() => items.filter((i) => i.labelStatus !== "Upcoming"), [items]);

  const renderItem = (it: Item) => (
    <UICard key={it.id} style={{ marginHorizontal: 16, marginBottom: 12 }}>
      <View style={{ padding: 12, flexDirection: "row", alignItems: "flex-start" }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Pill
            label={it.labelStatus}
            variant={
              it.labelStatus === "Upcoming" ? "success" : it.labelStatus === "Cancelled" ? "error" : "default"
            }
          />
          <Text style={{ marginTop: 8, fontWeight: "800" }}>
            {it.service} · {it.staff}
          </Text>
          <Text style={{ color: theme.colors.onSurfaceVariant }}>{it.business}</Text>
        </View>
        <View style={{ alignItems: "flex-end", minWidth: 120 }}>
          <View
            style={{
              borderWidth: 1,
              borderColor: theme.colors.outline,
              borderRadius: 12,
              paddingHorizontal: 10,
              paddingVertical: 6,
            }}
          >
            <Text style={{ fontWeight: "800" }}>{it.date}</Text>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>{it.time}</Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
        {it.labelStatus === "Upcoming" ? (
          <>
            <ActionButton
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: "/booking/date-time",
                  params: {
                    serviceId: it.raw.service?.id,
                    businessId: it.raw.business?.id,
                    bookingId: it.id, // Include booking ID for reschedule
                  },
                } as any)
              }
            >
              Reschedule
            </ActionButton>

            <ActionButton
              variant="secondary"
              onPress={() => {
                Alert.alert("Cancel booking", "Are you sure you want to cancel this booking?", [
                  { text: "No" },
                  {
                    text: "Yes, cancel",
                    style: "destructive",
                    onPress: async () => {
                      try {
                        // ⚠️ Send an OBJECT, not a raw string
                        const resp: any = await cancelBooking(
                          it.id,
                          { reason: "User cancelled" },
                          token
                        );

                        // Late cancellation: backend may return a checkout URL to collect a fee
                        if (resp?.checkoutUrl) {
                          try {
                            await Linking.openURL(resp.checkoutUrl);
                          } catch {
                            Alert.alert(
                              "Open payment",
                              "We couldn't open the payment page automatically. Please try again."
                            );
                          }
                        }

                        await load(); // Refresh the list either way
                      } catch (e: any) {
                        const status = e?.response?.status;
                        if (String(status) === "401") {
                          Alert.alert("Not authorized", "Please sign in again.");
                        } else {
                          Alert.alert("Cancel failed", e?.message || "Please try again.");
                        }
                      }
                    },
                  },
                ]);
              }}
            >
              Cancel booking
            </ActionButton>
          </>
        ) : (
          <ActionButton
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: "/booking/service",
                params: {
                  serviceId: it.raw.service?.id,
                  businessId: it.raw.business?.id,
                },
              } as any)
            }
          >
            Book again
          </ActionButton>
        )}
      </View>
    </UICard>
  );

  if (loading && !refreshing) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}>
          Loading your bookings…
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={{ marginHorizontal: 16, marginBottom: 8, fontWeight: "800" }}>
        Upcoming ({upcoming.length})
      </Text>
      {upcoming.length > 0 ? (
        upcoming.map(renderItem)
      ) : (
        <Text style={{ marginHorizontal: 16, color: theme.colors.onSurfaceVariant }}>
          No upcoming bookings.
        </Text>
      )}

      <Text style={{ marginHorizontal: 16, marginTop: 16, marginBottom: 8, fontWeight: "800" }}>
        Finished / Cancelled ({past.length})
      </Text>
      {past.length > 0 ? (
        past.map(renderItem)
      ) : (
        <Text style={{ marginHorizontal: 16, color: theme.colors.onSurfaceVariant }}>
          No past bookings yet.
        </Text>
      )}

      {/* Debug info in development */}
      {__DEV__ && (
        <View
          style={{
            marginHorizontal: 16,
            marginTop: 16,
            padding: 12,
            backgroundColor: theme.colors.surfaceVariant,
            borderRadius: 8,
          }}
        >
          <Text variant="bodySmall" style={{ fontWeight: "600" }}>
            Debug Info:
          </Text>
          <Text variant="bodySmall">Total items: {items.length}</Text>
          <Text variant="bodySmall">Upcoming: {upcoming.length}</Text>
          <Text variant="bodySmall">Past: {past.length}</Text>
          <Text variant="bodySmall">Has token: {!!token}</Text>
        </View>
      )}
    </ScrollView>
  );
}
