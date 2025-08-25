"use client";

import { useEffect, useState, useCallback } from "react";
import { View, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { Text, Searchbar, List, Button, Surface, Chip, useTheme } from "react-native-paper";
import { Link } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSession } from "../../../../context/SessionContext";
import { listStaff, reviewStaffEnrollment } from "../../../../lib/api/modules/manager";

export default function TeamList() {
  const theme = useTheme()
  const { token } = useSession();
  const [q, setQ] = useState("");
  const [approved, setApproved] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;           // wait for session
    setLoading(true);
    try {
      const data = await listStaff();
      const a = Array.isArray(data?.approvedStaff) ? data.approvedStaff : [];
      const p = Array.isArray(data?.pendingEnrollments) ? data.pendingEnrollments : [];
      setApproved(a);
      setPending(p);
    } catch {
      setApproved([]);
      setPending([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // 👇 Re-run the loader whenever this screen becomes focused (e.g., after saving in /team/new)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const filteredApproved = approved.filter((m) =>
    `${m.name ?? ""} ${m.email ?? ""}`.toLowerCase().includes(q.toLowerCase())
  );
  const filteredPending = pending.filter((e) =>
    `${e?.user?.name ?? ""} ${e?.user?.email ?? ""}`.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text variant="headlineSmall" style={{ fontWeight: "700" }}>
          Team
        </Text>
        <Link href="/business/dashboard/team/new" asChild>
          <Button mode="contained">Add Staff</Button>
        </Link>
      </View>

      <Searchbar value={q} onChangeText={setQ} placeholder="Search staff" style={{ borderRadius: 12 }} />

      {/* Approved staff */}
      <Text style={{ fontWeight: "700", marginTop: 8 }}>Approved</Text>
      <Surface elevation={1} style={{ borderRadius: 16 }}>
        {filteredApproved.map((u) => (
          <Link key={u.id} href={`./${u.id}`} asChild>
            <List.Item
              title={u.name ?? "—"}
              description={u.email ?? "—"}
              right={() => <Chip compact style={{ alignSelf: "center" }}>approved</Chip>}
            />
          </Link>
        ))}
        {filteredApproved.length === 0 && (
          <Text style={{ padding: 16, color: theme.colors.onSurfaceVariant }}>No staff yet.</Text>
        )}
      </Surface>

      {/* Pending enrollments */}
      <Text style={{ fontWeight: "700", marginTop: 16 }}>Pending</Text>
      <Surface elevation={1} style={{ borderRadius: 16 }}>
        {filteredPending.map((e) => (
          <List.Item
            key={e.id}
            title={e?.user?.name ?? "—"}
            description={e?.user?.email ?? "—"}
            right={() => (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button compact onPress={async () => {
                  await reviewStaffEnrollment({ enrollmentId: e.id, status: "APPROVED" });
                  load();
                }}>
                  Approve
                </Button>
                <Button compact onPress={async () => {
                  await reviewStaffEnrollment({ enrollmentId: e.id, status: "REJECTED" });
                  load();
                }}>
                  Reject
                </Button>
              </View>
            )}
          />
        ))}
        {filteredPending.length === 0 && (
          <Text style={{ padding: 16, color: theme.colors.onSurfaceVariant }}>No pending requests.</Text>
        )}
      </Surface>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
})