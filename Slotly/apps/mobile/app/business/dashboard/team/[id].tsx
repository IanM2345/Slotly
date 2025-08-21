"use client"

import { useEffect, useState } from "react"
import { View, ScrollView, StyleSheet, Alert } from "react-native"
import { Text, Surface, Button, Switch, IconButton, useTheme } from "react-native-paper"
import { useLocalSearchParams, useRouter } from "expo-router"
import { teamApi } from "../../../../lib/team/api"
import type { TeamMember } from "../../../../lib/team/types"

export default function TeamDetail() {
  const theme = useTheme()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [m, setM] = useState<TeamMember | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    ;(async () => setM((await teamApi.get(id!)) ?? null))()
  }, [id])

  const toggleActive = async () => {
    if (!m) return
    setBusy(true)
    const next = m.status === "active" ? "inactive" : "active"
    const updated = await teamApi.update(m.id, { status: next })
    setM(updated ?? m)
    setBusy(false)
  }

  const remove = () => {
    if (!m) return
    Alert.alert("Remove staff?", `${m.firstName} ${m.lastName}`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await teamApi.remove(m.id)
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
          {m.firstName} {m.lastName}
        </Text>
      </View>

      <Surface style={styles.card} elevation={2}>
        <Text style={{ marginBottom: 6 }}>Role: {m.role}</Text>
        <Text style={{ marginBottom: 6 }}>User ID: {m.userId}</Text>

        <View style={styles.row}>
          <Text>Status: {m.status}</Text>
          <Switch value={m.status === "active"} onValueChange={toggleActive} disabled={busy} />
        </View>

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
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
})
