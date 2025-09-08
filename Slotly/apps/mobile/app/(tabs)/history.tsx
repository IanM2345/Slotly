// apps/mobile/app/(tabs)/history.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, ScrollView, Alert, RefreshControl } from "react-native";
import { Text, useTheme, ActivityIndicator, Portal, Dialog, Button } from "react-native-paper";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import * as Linking from "expo-linking";
import DateTimePicker from "@react-native-community/datetimepicker";

import UICard from "../components/ui/Card";
import Pill from "../components/ui/Pill";
import ActionButton from "../components/ui/ActionButton";

import { listUserBookings, cancelBooking, rescheduleBooking, peekMyBookings } from "../../lib/api/modules/bookings";
import { useSession } from "../../context/SessionContext";

type ApiBooking = {
  id: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "RESCHEDULED" | "NO_SHOW";
  startTime: string;
  endTime?: string;
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
  const labelStatus: Item["labelStatus"] =
    bk.status === "CANCELLED" ? "Cancelled"
    : (bk.status === "COMPLETED" || bk.status === "NO_SHOW") ? "Finished"
    : start.getTime() > now.getTime() ? "Upcoming" : "Finished";
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

  const [resModalOpen, setResModalOpen] = useState(false);
  const [resBooking, setResBooking] = useState<null | Item>(null);
  const [pickDate, setPickDate] = useState<Date | null>(null);
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);

  const openResModal = (bk: Item) => {
    setResBooking(bk);
    setPickDate(new Date(bk.raw.startTime));
    setResModalOpen(true);
  };

  const closeResModal = () => {
    setResModalOpen(false);
    setResBooking(null);
    setPickDate(null);
  };

  useEffect(() => {
    const cached = peekMyBookings();
    if (cached) {
      const rows: ApiBooking[] = [...(cached.upcomingBookings || []), ...(cached.pastBookings || [])];
      const mapped = rows.map(toItem);
      const upcoming = mapped.filter(i => i.labelStatus === "Upcoming").sort((a, b) => +new Date(a.raw.startTime) - +new Date(b.raw.startTime));
      const past = mapped.filter(i => i.labelStatus !== "Upcoming").sort((a, b) => +new Date(b.raw.startTime) - +new Date(a.raw.startTime));
      setItems([...upcoming, ...past]);
      setLoading(false);
    }
  }, []);

  const hydrate = useCallback(async () => {
    if (!token) {
      setItems([]);
      setLoading(false);
      return;
    }
    try {
      const data = await listUserBookings();
      const rows: ApiBooking[] = [
        ...(Array.isArray(data?.upcomingBookings) ? data.upcomingBookings : []),
        ...(Array.isArray(data?.pastBookings) ? data.pastBookings : []),
      ];
      const mapped = rows.map(toItem);
      const upcoming = mapped.filter(i => i.labelStatus === "Upcoming").sort((a, b) => +new Date(a.raw.startTime) - +new Date(b.raw.startTime));
      const past = mapped.filter(i => i.labelStatus !== "Upcoming").sort((a, b) => +new Date(b.raw.startTime) - +new Date(a.raw.startTime));
      setItems([...upcoming, ...past]);
    } catch (e: any) {
      console.error("Failed to load bookings:", e);
      if (!items.length) Alert.alert("Failed to load bookings", e?.message || "Please try again.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { hydrate(); }, [hydrate]);
  useFocusEffect(useCallback(() => { hydrate(); }, [hydrate]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await hydrate();
    setRefreshing(false);
  }, [hydrate]);

  const upcoming = useMemo(() => items.filter(i => i.labelStatus === "Upcoming"), [items]);
  const past = useMemo(() => items.filter(i => i.labelStatus !== "Upcoming"), [items]);

  const renderItem = (it: Item) => {
    const isFinished = it.labelStatus === "Finished";
    const isCancelled = it.labelStatus === "Cancelled";

    return (
      <UICard key={it.id} style={{ marginHorizontal: 16, marginBottom: 12 }}>
        <View style={{ padding: 12, flexDirection: "row", alignItems: "flex-start" }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Pill
              label={it.labelStatus}
              variant={it.labelStatus === "Upcoming" ? "success" : it.labelStatus === "Cancelled" ? "error" : "default"}
            />
            <Text style={{ marginTop: 8, fontWeight: "800" }}>
              {it.service} · {it.staff}
            </Text>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>{it.business}</Text>
          </View>
          <View style={{ alignItems: "flex-end", minWidth: 120 }}>
            <View style={{ borderWidth: 1, borderColor: theme.colors.outline, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ fontWeight: "800" }}>{it.date}</Text>
              <Text style={{ color: theme.colors.onSurfaceVariant }}>{it.time}</Text>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
          {it.labelStatus === "Upcoming" ? (
            <>
              <ActionButton variant="secondary" onPress={() => openResModal(it)}>
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
                          const resp = await cancelBooking(it.id, { reason: "User cancelled" });
                          if (resp?.checkoutUrl) {
                            try { await Linking.openURL(resp.checkoutUrl); } catch {}
                            Alert.alert("Late cancellation", "Complete the fee payment to finalize cancellation.");
                          } else {
                            Alert.alert("Cancelled", resp?.message || "Booking cancelled.");
                          }
                          await hydrate();
                        } catch (e: any) {
                          const msg = e?.response?.data?.error || e?.message || "Please try again.";
                          Alert.alert("Cancel failed", msg);
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
            <>
              {/* Only show review button for Finished bookings (COMPLETED/NO_SHOW), not Cancelled */}
              {isFinished && (
                <ActionButton
                  variant="primary"
                  icon="star"
                  onPress={() =>
                    router.push({
                      pathname: "/service-review",
                      params: {
                        bookingId: it.raw.id,
                        businessId: it.raw.business?.id,
                        businessName: it.raw.business?.name || "Business",
                      },
                    } as any)
                  }
                >
                  Review
                </ActionButton>
              )}

              <ActionButton
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: "/booking/service",
                    params: { serviceId: it.raw.service?.id, businessId: it.raw.business?.id },
                  } as any)
                }
              >
                Book again
              </ActionButton>
            </>
          )}
        </View>
      </UICard>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}>Loading your bookings…</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={{ marginHorizontal: 16, marginBottom: 8, fontWeight: "800" }}>
          Upcoming ({upcoming.length})
        </Text>
        {upcoming.length ? upcoming.map(renderItem) : (
          <Text style={{ marginHorizontal: 16, color: theme.colors.onSurfaceVariant }}>No upcoming bookings.</Text>
        )}

        <Text style={{ marginHorizontal: 16, marginTop: 16, marginBottom: 8, fontWeight: "800" }}>
          Finished / Cancelled ({past.length})
        </Text>
        {past.length ? past.map(renderItem) : (
          <Text style={{ marginHorizontal: 16, color: theme.colors.onSurfaceVariant }}>No past bookings yet.</Text>
        )}
      </ScrollView>

      {/* Reschedule Modal */}
      <Portal>
        <Dialog visible={resModalOpen} onDismiss={closeResModal}>
          <Dialog.Title>Reschedule</Dialog.Title>
          <Dialog.Content>
            <Text>Select new date & time for:</Text>
            <Text style={{ fontWeight: "700", marginTop: 4 }}>{resBooking?.service}</Text>

            <View style={{ marginTop: 12, gap: 8 }}>
              <Button mode="outlined" onPress={() => setShowDate(true)}>
                {pickDate ? `Date: ${pickDate.toLocaleDateString()}` : "Pick date"}
              </Button>
              <Button mode="outlined" onPress={() => setShowTime(true)}>
                {pickDate ? `Time: ${pickDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "Pick time"}
              </Button>
            </View>

            {showDate && (
              <DateTimePicker
                value={pickDate ?? new Date()}
                mode="date"
                onChange={(_, d) => {
                  setShowDate(false);
                  if (d) {
                    const base = pickDate ?? new Date();
                    const nd = new Date(d);
                    nd.setHours(base.getHours(), base.getMinutes(), 0, 0);
                    setPickDate(nd);
                  }
                }}
              />
            )}

            {showTime && (
              <DateTimePicker
                value={pickDate ?? new Date()}
                mode="time"
                onChange={(_, t) => {
                  setShowTime(false);
                  if (t) {
                    const base = pickDate ?? new Date();
                    const nd = new Date(base);
                    nd.setHours(t.getHours(), t.getMinutes(), 0, 0);
                    setPickDate(nd);
                  }
                }}
              />
            )}
          </Dialog.Content>

          <Dialog.Actions>
            <Button onPress={closeResModal}>Close</Button>
            <Button
              mode="contained"
              onPress={async () => {
                if (!resBooking || !pickDate) return;
                try {
                  const minutes = resBooking.raw.service?.duration ?? 60;
                  const end = new Date(pickDate.getTime() + minutes * 60000);

                  await rescheduleBooking(resBooking.id, {
                    startTime: pickDate.toISOString(),
                    endTime: end.toISOString(),
                  });
                  Alert.alert("Rescheduled", "Your booking was moved.");
                  closeResModal();
                  await hydrate();
                } catch (e: any) {
                  const msg = e?.response?.data?.error || e?.message || "Please try again.";
                  Alert.alert("Reschedule failed", msg);
                }
              }}
            >
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}