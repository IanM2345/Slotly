// apps/mobile/app/(tabs)/profile.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { View, ScrollView, Platform, Share, TouchableOpacity, RefreshControl } from "react-native";
import {
  Text,
  Avatar,
  Button,
  Card,
  Divider,
  IconButton,
  useTheme,
  Chip,
  Snackbar,
  ActivityIndicator,
} from "react-native-paper";
import { useRouter } from "expo-router";
import { useSession } from "../../context/SessionContext";

import ListRow from "../components/ui/ListRow";
import UICard from "../components/ui/Card";

import { getMe, listBookings } from "../../lib/api/modules/users";
import { getCurrentUser } from "../../lib/api/modules/auth"; // <-- pulls /api/auth/me (has createdAt)

type ApiBooking = {
  id: string;
  startTime: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "RESCHEDULED" | "NO_SHOW";
  service?: { id: string; name: string; duration?: number; price?: number; imageUrl?: string };
  business?: { id: string; name: string; address?: string; logoUrl?: string; latitude?: number; longitude?: number };
  staff?: { id: string; name?: string };
};

type UserLite = {
  id?: string;
  userId?: string;
  name?: string;
  email?: string;
  phone?: string;
  createdAt?: string;
  profileImage?: string;
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
  const { user: sessionUser, token } = useSession(); // <-- token for users API

  const [user, setUser] = useState<UserLite | null>(sessionUser ?? null);
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [snack, setSnack] = useState<{ visible: boolean; msg: string }>({ visible: false, msg: "" });

  const resolvedUserId = useMemo(() => user?.userId || user?.id || "", [user]);

  // Load user + bookings
  const load = useCallback(async () => {
    setLoading(true);
    try {
      // 1) Prefer current authenticated user (from /api/auth/me) — includes createdAt & name
      const authUser = await getCurrentUser().catch(() => null);

      // 2) Also fetch /api/users/me as a supplement; pass token so it's always authorized
      const usersMe = await getMe(token).catch(() => null);

      // 3) Merge sources (authUser has createdAt; usersMe may have phone/role; session has whatever is cached)
      const merged: UserLite = {
        ...(sessionUser ?? {}),
        ...(usersMe ?? {}),
        ...(authUser ?? {}),
      };

      setUser(merged);

      // Bookings of current user (server infers user by token)
      const data = await listBookings(token).catch(() => null);
      const rows: ApiBooking[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.upcomingBookings) || Array.isArray(data?.pastBookings)
        ? [
            ...(Array.isArray(data.upcomingBookings) ? data.upcomingBookings : []),
            ...(Array.isArray(data.pastBookings) ? data.pastBookings : []),
          ]
        : [];

      rows.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
      setBookings(rows);
    } catch (error) {
      console.error("Failed to load profile data:", error);
    } finally {
      setLoading(false);
    }
  }, [sessionUser, token]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  // Derived: join date from createdAt
  const joinDate = useMemo(() => {
    const created = user?.createdAt;
    if (!created) return "—";
    const d = new Date(created);
    // e.g. "January 2024"
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }, [user?.createdAt]);

  const totalBookings = bookings.length;

  // Derived: favourites (services booked >= 2 times)
  const favouriteServices: ChipItem[] = useMemo(() => {
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
    const favs = [...counts.entries()]
      .filter(([, v]) => v.n >= 2)
      .map(([serviceId, v]) => ({ 
        id: serviceId, 
        name: v.name, 
        image: v.image || PHL.service, 
        serviceId, 
        businessId: v.businessId 
      }))
      .sort((a, b) => (counts.get(b.id)!.lastSeenAt - counts.get(a.id)!.lastSeenAt));
    return favs;
  }, [bookings]);

  // Derived: frequently visited (five most recent UNIQUE businesses)
  const frequentBusinesses: ChipItem[] = useMemo(() => {
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
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}>
          Loading your profile…
        </Text>
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
            source={{ uri: user?.profileImage || "https://via.placeholder.com/150x150.png?text=ME" }} 
          />
          <View style={{ marginLeft: 16, flex: 1 }}>
            {/* Hello + Name inline */}
            <Text variant="headlineSmall" style={{ marginBottom: 2 }}>
              Hello,{" "}
              <Text style={{ fontWeight: "800", color: theme.colors.primary }}>
                {displayName}
              </Text>
            </Text>

            {/* Member since from createdAt */}
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

        {/* Contact stats */}
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

      {/* Edit Profile CTA */}
      <Button 
        style={{ marginHorizontal: 16 }} 
        mode="contained" 
        onPress={() => router.push("/edit-profile" as any)}
      >
        Edit Profile
      </Button>

      <Snackbar 
        visible={snack.visible} 
        onDismiss={() => setSnack({ visible: false, msg: "" })} 
        duration={2200} 
        style={{ marginHorizontal: 16, marginTop: 10 }}
      >
        {snack.msg}
      </Snackbar>

      <View style={{ height: 80 }} />
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