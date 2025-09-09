"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Image,
  TouchableOpacity,
} from "react-native";
import {
  Text,
  ActivityIndicator,
  IconButton,
  Surface,
  Chip,
  useTheme,
} from "react-native-paper";
import { useRouter } from "expo-router";

// APIs
import { staffMe, staffAssignedServices } from "../../../../lib/api/modules/staff";
import { getMe as getUserMe } from "../../../../lib/api/modules/users";
import { getTokens } from "../../../../lib/api/client";

type AssignedService = {
  id: string;
  name: string;
  price?: number;
  duration?: number; // minutes
};

export default function StaffProfileScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // user/business
  const [staffId, setStaffId] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string>("");
  const [businessLogo, setBusinessLogo] = useState<string | null>(null);

  // services assigned
  const [services, setServices] = useState<AssignedService[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      // 1) Staff + business context
      const me = await staffMe(); // token auto-attached by client
      const user = me?.user || me?.staff || {};
      const activeBiz = me?.activeBusiness || null;

      setStaffId(user?.id || "");
      setName(user?.name || user?.firstName?.concat(user?.lastName ? ` ${user.lastName}` : "") || "—");
      setBusinessName(activeBiz?.name || "—");
      setBusinessLogo(activeBiz?.logoUrl || null);

      // 2) Avatar from users.js (/api/users/me)
      try {
        const tks = (await getTokens?.()) || {};
        const profile = await getUserMe(tks?.accessToken);
        const a =
          profile?.avatarUrl ??
          profile?.avatarURI ??
          profile?.avatarUri ??
          null;
        setAvatarUrl(a);
        if (!name || name === "—") {
          const fallbackName = profile?.name || (profile?.firstName && `${profile.firstName}${profile.lastName ? ` ${profile.lastName}` : ""}`);
          if (fallbackName) setName(fallbackName);
        }
        if (!staffId && profile?.id) setStaffId(profile.id);
      } catch (e) {
        // soft fail for avatar/me
      }

      // 3) Assigned services
      const svc = await staffAssignedServices();
      setServices(Array.isArray(svc) ? svc : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load profile");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [name, staffId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const initials = useMemo(() => {
    if (!name) return " ";
    const parts = name.trim().split(/\s+/);
    return (parts[0]?.[0] || "").concat(parts[1]?.[0] || "").toUpperCase();
  }, [name]);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      <View style={styles.header}>
        <IconButton icon="arrow-left" size={24} onPress={() => router.back()} />
        <Text style={styles.title}>My Profile</Text>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator />
          <Text style={{ marginTop: 10, color: "#6B7280" }}>Loading…</Text>
        </View>
      ) : (
        <>
          {error && (
            <Surface style={styles.banner} elevation={1}>
              <Text style={{ color: theme.colors.error }}>{error}</Text>
            </Surface>
          )}

          {/* Top card - avatar + name + staff id */}
          <Surface style={styles.card} elevation={1}>
            <View style={styles.row}>
              <TouchableOpacity activeOpacity={0.9} style={styles.avatarWrap}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={{ color: "#fff", fontWeight: "700" }}>{initials}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.name}>{name || "—"}</Text>
                <Text style={styles.meta}>Staff ID: <Text style={styles.metaBold}>{staffId || "—"}</Text></Text>
              </View>
            </View>
          </Surface>

          {/* Business */}
          <Surface style={styles.card} elevation={1}>
            <Text style={styles.sectionTitle}>Business</Text>
            <View style={[styles.row, { marginTop: 12 }]}>
              {businessLogo ? (
                <Image source={{ uri: businessLogo }} style={styles.bizLogo} />
              ) : (
                <View style={[styles.bizLogo, styles.bizLogoFallback]}>
                  <Text style={{ color: "#fff" }}>🏢</Text>
                </View>
              )}
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.bizName}>{businessName || "—"}</Text>
                <Text style={styles.meta}>Active workplace</Text>
              </View>
            </View>
          </Surface>

          {/* Assigned services */}
          <Surface style={styles.card} elevation={1}>
            <Text style={styles.sectionTitle}>Assigned Services</Text>
            {services.length === 0 ? (
              <Text style={styles.emptyNote}>No services assigned yet.</Text>
            ) : (
              <View style={styles.chipsWrap}>
                {services.map((s) => (
                  <Chip key={s.id} style={styles.chip} compact>
                    {s.name}
                  </Chip>
                ))}
              </View>
            )}
          </Surface>
        </>
      )}
    </ScrollView>
  );
}

const AVATAR_SIZE = 72;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingTop: 60, paddingBottom: 16 },
  title: { fontSize: 22, fontWeight: "700", color: "#1559C1" },

  loading: { alignItems: "center", paddingTop: 60 },

  banner: { backgroundColor: "#FFF", marginHorizontal: 16, padding: 12, borderRadius: 10, marginBottom: 8 },

  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
  },

  row: { flexDirection: "row", alignItems: "center" },

  avatarWrap: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, overflow: "hidden" },
  avatar: { width: "100%", height: "100%", borderRadius: AVATAR_SIZE / 2 },
  avatarFallback: { backgroundColor: "#0EA5E9", alignItems: "center", justifyContent: "center" },

  name: { fontSize: 18, fontWeight: "700", color: "#111827" },
  meta: { color: "#6B7280", marginTop: 2 },
  metaBold: { color: "#111827", fontWeight: "600" },

  sectionTitle: { fontWeight: "700", color: "#111827" },

  bizLogo: { width: 44, height: 44, borderRadius: 8 },
  bizLogoFallback: { backgroundColor: "#93C5FD", alignItems: "center", justifyContent: "center" },
  bizName: { fontSize: 16, fontWeight: "600", color: "#111827" },

  chipsWrap: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
  chip: { marginRight: 8, marginBottom: 8 },

  emptyNote: { marginTop: 10, color: "#6B7280" },
});
