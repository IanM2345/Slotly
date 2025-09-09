"use client";

import { useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, Alert } from "react-native";
import { Text, Surface, Button, IconButton, useTheme } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { listStaff, removeStaff } from "../../../../lib/api/modules/manager";
import { useSession } from "../../../../context/SessionContext";

export default function TeamDetail() {
  const theme = useTheme()
  const router = useRouter()
  const { user } = useSession();
  const businessId = user?.business?.id;
  const { id } = useLocalSearchParams<{ id: string }>()
  const [m, setM] = useState<any | null>(null)

  useEffect(() => {
    (async () => {
      const data = await listStaff(businessId);
      const match = (data?.approvedStaff ?? []).find((u: any) => String(u.id) === String(id));
      setM(match ?? null);
    })();
  }, [id, businessId])

  const remove = () => {
    if (!m) return
    Alert.alert("Remove staff?", `${m?.name ?? "—"}`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await removeStaff(m.id, businessId);
          router.replace("..")
        },
      },
    ])
  }

  if (!m) return null

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => router.back()} />
        <Text style={styles.title}>
          {m?.name ?? "Staff Member"}
        </Text>
      </View>

      <Surface style={styles.card} elevation={2}>
        <Text style={{ marginBottom: 6 }}>Name: {m?.name ?? "—"}</Text>
        <Text style={{ marginBottom: 6 }}>Email: {m?.email ?? "—"}</Text>
        <Text style={{ marginBottom: 6 }}>Phone: {m?.phone ?? "—"}</Text>

        <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
          <Button mode="outlined" onPress={() => router.back()} style={{ flex: 1 }}>
            Back
          </Button>
          <Button mode="contained" onPress={remove} style={{ flex: 1 }}>
            Remove
          </Button>
        </View>
      </Surface>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingTop: 60, paddingBottom: 20 },
  title: { fontSize: 22, fontWeight: "bold", color: "#1559C1" },
  card: { backgroundColor: "#FFF", borderRadius: 12, padding: 16, marginHorizontal: 16 },
})