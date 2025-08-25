"use client"

import { useEffect, useState } from "react"
import { View, ScrollView, StyleSheet } from "react-native"
import { Text, Surface, TextInput, Button, IconButton, Checkbox, Snackbar, useTheme } from "react-native-paper"
import { useRouter } from "expo-router"
import { listServices, createBundle } from "../../../../../lib/api/modules/manager"

type Service = { id: string; name: string; price: number }

export default function BundleNew() {
  const theme = useTheme()
  const router = useRouter()
  const [services, setServices] = useState<Service[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [name, setName] = useState("")
  const [price, setPrice] = useState("")
  const [emoji, setEmoji] = useState("📦")
  const [saving, setSaving] = useState(false)
  const [snack, setSnack] = useState<{ visible: boolean; msg: string }>({ visible: false, msg: "" })

  useEffect(() => {
    (async () => {
      try {
        const svc = await listServices()
        setServices(Array.isArray(svc) ? svc.map(s => ({ id: s.id, name: s.name, price: s.price ?? 0 })) : [])
      } catch (e: any) {
        // plan may not include bundles; still render form with empty list
        setServices([])
        setSnack({ visible: true, msg: e?.response?.data?.error || "Bundles may be unavailable on your plan" })
      }
    })()
  }, [])

  const toggle = (id: string) => setSelected((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]))

  const isValid = name.trim().length >= 2 && Number(price) > 0 && selected.length >= 2

  const save = async () => {
    if (!isValid) return
    setSaving(true)
    try {
      await createBundle({
        name: name.trim(),
        price: Math.max(0, parseInt(price, 10) || 0),
        duration: 0, // optional: compute sum or ask user; keep 0 safe
        serviceIds: selected,
      })
      setSnack({ visible: true, msg: "Bundle created" })
      setTimeout(() => router.replace(".."), 350)
    } catch (e: any) {
      const msg = e?.response?.status === 403
        ? (e?.response?.data?.error || "Your plan does not support bundles")
        : (e?.response?.data?.error || e?.message || "Failed to create bundle")
      setSnack({ visible: true, msg })
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => router.back()} />
        <Text style={styles.title}>Create Bundle</Text>
      </View>

      <Surface style={styles.card} elevation={2}>
        <TextInput label="Bundle Name *" mode="outlined" value={name} onChangeText={setName} style={styles.input} />
        <TextInput label="Emoji" mode="outlined" value={emoji} onChangeText={setEmoji} style={styles.input} />
        <TextInput
          label="Price (KSh) *"
          mode="outlined"
          value={price}
          onChangeText={setPrice}
          keyboardType="numeric"
          style={styles.input}
        />
      </Surface>

      <Surface style={styles.card} elevation={2}>
        <Text style={{ fontWeight: "600", marginBottom: 8 }}>Included Services (min 2)</Text>
        {services.length === 0 ? (
          <Text style={{ color: "#6B7280" }}>No services yet.</Text>
        ) : services.map((s) => (
          <View key={s.id} style={styles.row}>
            <Checkbox status={selected.includes(s.id) ? "checked" : "unchecked"} onPress={() => toggle(s.id)} />
            <Text style={{ flex: 1 }}>{s.name}</Text>
            <Text>KSh {s.price.toLocaleString()}</Text>
          </View>
        ))}
      </Surface>

      <View style={styles.actions}>
        <Button mode="outlined" onPress={() => router.back()} style={styles.btn}>
          Cancel
        </Button>
        <Button mode="contained" onPress={save} disabled={!isValid || saving} loading={saving} style={styles.btn}>
          Save Bundle
        </Button>
      </View>

      <View style={{ height: 40 }} />
      <Snackbar visible={snack.visible} onDismiss={() => setSnack({ visible: false, msg: "" })} duration={2500}>
        {snack.msg}
      </Snackbar>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingTop: 60, paddingBottom: 20 },
  title: { fontSize: 24, fontWeight: "bold", color: "#1559C1" },
  card: { backgroundColor: "#FFF", borderRadius: 12, padding: 16, marginHorizontal: 16, marginBottom: 12 },
  input: { marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 8 },
  actions: { flexDirection: "row", gap: 12, paddingHorizontal: 16, marginTop: 12 },
  btn: { flex: 1 },
})