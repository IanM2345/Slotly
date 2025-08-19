"use client"

import { useEffect, useState } from "react"
import { View, ScrollView, StyleSheet } from "react-native"
import { Text, Searchbar, List, Button, Surface, Chip, useTheme } from "react-native-paper"
import { Link } from "expo-router"
import { teamApi } from "../../../../lib/team/api"
import type { TeamMember } from "../../../../lib/team/types"

export default function TeamList() {
  const theme = useTheme()
  const [q, setQ] = useState("")
  const [items, setItems] = useState<TeamMember[]>([])

  useEffect(() => {
    ;(async () => setItems(await teamApi.list()))()
  }, [])
  const filtered = items.filter((m) =>
    `${m.firstName} ${m.lastName} ${m.email}`.toLowerCase().includes(q.toLowerCase()),
  )

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
    >
      <View style={styles.header}>
        <Text variant="headlineSmall" style={{ fontWeight: "700" }}>
          Team
        </Text>
        <Link href="./new" asChild>
          <Button mode="contained">Add Staff</Button>
        </Link>
      </View>

      <Searchbar value={q} onChangeText={setQ} placeholder="Search staff" style={{ borderRadius: 12 }} />

      <Surface elevation={1} style={{ borderRadius: 16 }}>
        {filtered.map((m) => (
          <Link key={m.id} href={`./${m.id}`} asChild>
            <List.Item
              title={`${m.firstName} ${m.lastName}`}
              description={`${m.role} • ${m.email}`}
              right={() => (
                <Chip compact style={{ alignSelf: "center" }}>
                  {m.status}
                </Chip>
              )}
            />
          </Link>
        ))}
        {filtered.length === 0 && (
          <Text style={{ padding: 16, color: theme.colors.onSurfaceVariant }}>No staff yet.</Text>
        )}
      </Surface>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
})
