// apps/mobile/app/(tabs)/profile.tsx
import React, { useEffect, useState, useCallback } from "react";
import { View, ScrollView, Alert, RefreshControl, Platform, Share, TouchableOpacity } from "react-native";
import {
  Text,
  Avatar,
  Button,
  Card,
  Divider,
  useTheme,
  ActivityIndicator,
  IconButton,
  Chip,
  Snackbar,
} from "react-native-paper";
import { useRouter, useFocusEffect } from "expo-router";
import { getMe, deleteMe, listBookings } from "../../lib/api/modules/users";
import { useSession } from "../../context/SessionContext";
import UICard from "../components/ui/Card";
import ListRow from "../components/ui/ListRow";

type ApiBooking = {
  id: string;
  startTime: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "RESCHEDULED" | "NO_SHOW";
  service?: { id: string; name: string; duration?: number; price?: number; imageUrl?: string };
  business?: { id: string; name: string; address?: string; logoUrl?: string; latitude?: number; longitude?: number };
  staff?: { id: string; name?: string };
};

type ChipItem = { 
  id: string; 
  name: string; 
  image?: string; 
  serviceId?: string; 
  businessId?: string; 
};

const PHL = {
  service: "https://via.placeholder.com/60x60.png?text=Svc",
  biz: "https://via.placeholder.com/60x60.png?text=Biz",
};

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { token, user: sessionUser, setUser, logout } = useSession();

  const [user, setUserLocal] = useState(sessionUser || null);
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [loading, setLoading] = useState(!sessionUser);
  const [refreshing, setRefreshing] = useState(false);
  const [snack, setSnack] = useState<{ visible: boolean; msg: string }>({ visible: false, msg: "" });

  const load = useCallback(async () => {
    try {
      // Load fresh profile data
      const me = await getMe(token);
      setUserLocal(me);
      setUser?.(me); // Keep global cache hot (Home avatar will update instantly)
      
      // Load bookings for stats
      const bookingData = await listBookings(token);
      const allBookings = [
        ...(Array.isArray(bookingData?.upcomingBookings) ? bookingData.upcomingBookings : []),
        ...(Array.isArray(bookingData?.pastBookings) ? bookingData.pastBookings : []),
      ];
      setBookings(allBookings);
    } catch (e) {
      // Fix: Properly type the error and handle the message
      const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
      console.log("Failed to load profile data", errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, setUser]);

  useEffect(() => { 
    load(); 
  }, [load]);

  // When this screen is focused again (e.g., after saving in Edit Profile), reload.
  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [load])
  );

  // If the session user changes (Edit Profile calls setUser), reflect it right away.
  useEffect(() => {
    if (sessionUser) setUserLocal(sessionUser);
  }, [sessionUser]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  // Derived data
  const joinDate = user?.createdAt 
    ? new Date(user.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : "—";
  
  const totalBookings = bookings.length;
  const resolvedUserId = user?.userId || user?.id || "";

  // Favourite services (booked 2+ times)
  const favouriteServices: ChipItem[] = React.useMemo(() => {
    if (!bookings.length) return [];
    const counts = new Map<string, { name: string; image?: string; businessId?: string; lastSeenAt: number; n: number }>();
    
    for (const bk of bookings) {
      const svc = bk.service;
      if (!svc?.id) continue;
      const ts = new Date(bk.startTime).getTime();
      const prev = counts.get(svc.id);
      if (!prev) {
        counts.set(svc.id, { 
          name: svc.name || "Service", 
          image: svc.imageUrl, 
          businessId: bk.business?.id, 
          lastSeenAt: ts, 
          n: 1 
        });
      } else {
        prev.lastSeenAt = Math.max(prev.lastSeenAt, ts);
        prev.n += 1;
      }
    }
    
    return [...counts.entries()]
      .filter(([, v]) => v.n >= 2)
      .map(([serviceId, v]) => ({ 
        id: serviceId, 
        name: v.name, 
        image: v.image || PHL.service, 
        serviceId, 
        businessId: v.businessId 
      }))
      .sort((a, b) => (counts.get(b.id)!.lastSeenAt - counts.get(a.id)!.lastSeenAt));
  }, [bookings]);

  // Frequently visited businesses (5 most recent unique)
  const frequentBusinesses: ChipItem[] = React.useMemo(() => {
    if (!bookings.length) return [];
    const seen = new Set<string>();
    const uniq: ChipItem[] = [];
    
    for (const bk of bookings) {
      const biz = bk.business;
      if (!biz?.id || seen.has(biz.id)) continue;
      seen.add(biz.id);
      uniq.push({ 
        id: biz.id, 
        name: biz.name || "Business", 
        image: biz.logoUrl || PHL.biz, 
        businessId: biz.id 
      });
      if (uniq.length >= 5) break;
    }
    return uniq;
  }, [bookings]);

  const onDelete = useCallback(() => {
    Alert.alert("Delete account", "This will permanently delete your profile and bookings. Continue?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteMe(token);
            await logout?.();
            router.replace("/auth/signup" as any);
          } catch (e) {
            // Fix: Properly handle error type
            const errorMessage = e instanceof Error ? e.message : "Unknown error occurred";
            Alert.alert("Delete failed", errorMessage || "Try again later");
          }
        },
      },
    ]);
  }, [token, router, logout]);

  const copyOrShareUserId = async () => {
    if (!resolvedUserId) return;
    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && (navigator as any).clipboard?.writeText) {
        await (navigator as any).clipboard.writeText(resolvedUserId);
        setSnack({ visible: true, msg: "User ID copied" });
      } else {
        await Share.share({ message: `My Slotly User ID: ${resolvedUserId}` });
        setSnack({ visible: true, msg: "User ID ready to share" });
      }
    } catch {
      setSnack({ visible: true, msg: "Could not copy/share User ID" });
    }
  };

  const onTapFavouriteService = (svc: ChipItem) => {
    router.push({ 
      pathname: "/booking/service", 
      params: { 
        serviceId: svc.serviceId || svc.id, 
        businessId: svc.businessId || "" 
      } 
    } as any);
  };

  const onTapBusiness = (biz: ChipItem) => {
    router.push({ 
      pathname: "/explore/explore-services", 
      params: { 
        businessId: biz.businessId || biz.id 
      } 
    } as any);
  };

  if (loading && !refreshing) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}>
          Loading profile…
        </Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}>
        <Text>No profile data</Text>
        <Button onPress={() => router.replace("/auth/signup" as any)}>Go to Sign up</Button>
      </View>
    );
  }

  const displayName = user?.name || user?.email || "—";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <IconButton icon="cog" size={24} onPress={() => router.push("/settings" as any)} />
      </View>

      {/* Profile summary */}
      <UICard style={{ marginHorizontal: 16, marginBottom: 16, padding: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
          <Avatar.Image 
            size={80} 
            source={{ uri: user?.avatarUrl || "https://via.placeholder.com/150x150.png?text=ME" }} 
          />
          <View style={{ marginLeft: 16, flex: 1 }}>
            <Text variant="headlineSmall" style={{ marginBottom: 2 }}>
              Hello,{" "}
              <Text style={{ fontWeight: "800", color: theme.colors.primary }}>
                {displayName}
              </Text>
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Member since {joinDate}
            </Text>
          </View>
        </View>

        {/* ID row */}
        <Card mode="contained" style={{ borderRadius: 12, overflow: "hidden" }}>
          <View style={{ flexDirection: "row", alignItems: "center", padding: 12, gap: 10 }}>
            <View style={{ backgroundColor: "rgba(245,124,0,0.15)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ fontWeight: "800", color: theme.colors.secondary }}>USER ID</Text>
            </View>
            <Text 
              selectable 
              style={{ fontSize: 16, fontWeight: "700", letterSpacing: 0.4, color: theme.colors.onSurface, flex: 1 }}
            >
              {resolvedUserId || "—"}
            </Text>
            {!!resolvedUserId && (
              <Chip 
                icon={Platform.OS === "web" ? "content-copy" : "share-variant"} 
                onPress={copyOrShareUserId} 
                compact
              >
                {Platform.OS === "web" ? "Copy" : "Share"}
              </Chip>
            )}
          </View>
        </Card>

        {/* Contact & stats */}
        <Card mode="outlined" style={{ marginTop: 12 }}>
          <Card.Content>
            <ListRow label="Email" value={user?.email || "—"} />
            <Divider />
            <ListRow label="Phone" value={user?.phone || "—"} />
            <Divider />
            <ListRow label="Total Bookings" value={String(totalBookings)} />
          </Card.Content>
        </Card>
      </UICard>

      {/* Favourites */}
      <Section title="Favourites">
        {favouriteServices.length === 0 ? (
          <EmptyRow caption="We'll surface services you book 2+ times here." />
        ) : (
          <HScroller 
            items={favouriteServices} 
            onItemPress={onTapFavouriteService} 
          />
        )}
      </Section>

      {/* Frequently visited */}
      <Section title="Frequently visited">
        {frequentBusinesses.length === 0 ? (
          <EmptyRow caption="Once you book, your most recent businesses appear here." />
        ) : (
          <HScroller 
            items={frequentBusinesses} 
            onItemPress={onTapBusiness} 
          />
        )}
      </Section>

      {/* Quick actions */}
      <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 16, marginBottom: 20 }}>
        <Button mode="outlined" style={{ flex: 1 }} onPress={() => router.push("/(tabs)/history" as any)}>
          Booking History
        </Button>
        <Button mode="outlined" style={{ flex: 1 }} onPress={() => router.push("/favorites" as any)}>
          My Favorites
        </Button>
      </View>

      {/* Main actions */}
      <View style={{ paddingHorizontal: 16, gap: 8, marginBottom: 20 }}>
        <Button mode="contained" onPress={() => router.push("/edit-profile" as any)}>
          Edit profile
        </Button>
        <Button mode="outlined" onPress={onDelete} textColor={theme.colors.error}>
          Delete account
        </Button>
      </View>

      <Snackbar 
        visible={snack.visible} 
        onDismiss={() => setSnack({ visible: false, msg: "" })} 
        duration={2200} 
      >
        {snack.msg}
      </Snackbar>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ marginHorizontal: 16, marginBottom: 18 }}>
      <Text variant="titleMedium" style={{ fontWeight: "800", color: theme.colors.primary, marginBottom: 8 }}>
        {title}
      </Text>
      <UICard>{children}</UICard>
    </View>
  );
}

function HScroller({
  items,
  onItemPress,
}: {
  items: ChipItem[];
  onItemPress: (x: ChipItem) => void;
}) {
  const theme = useTheme();
  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false} 
      contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12, gap: 12 }}
    >
      {items.map((x) => (
        <TouchableOpacity key={x.id} onPress={() => onItemPress(x)}>
          <View style={{ alignItems: "center", width: 84 }}>
            <Avatar.Image 
              size={60} 
              source={{ uri: x.image || PHL.service }} 
              style={{ backgroundColor: theme.colors.surface }} 
            />
            <Text 
              numberOfLines={1} 
              style={{ fontSize: 12, marginTop: 6, color: theme.colors.onSurface, fontWeight: "600" }}
            >
              {x.name}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function EmptyRow({ caption }: { caption: string }) {
  const theme = useTheme();
  return (
    <View style={{ padding: 16, alignItems: "center" }}>
      <Text style={{ color: theme.colors.onSurfaceVariant }}>{caption}</Text>
    </View>
  );
}