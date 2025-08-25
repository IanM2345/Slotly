"use client"

import { useState } from "react"
import { View, ScrollView, StyleSheet } from "react-native"
import { Text, Surface, TextInput, Button, IconButton, Snackbar, useTheme } from "react-native-paper"
import { useRouter } from "expo-router"
import { createService } from "../../../../../lib/api/modules/manager"
import * as Sentry from "sentry-expo"

export default function ServiceNew() {
  const theme = useTheme()
  const router = useRouter()
  const [name, setName] = useState("")
  const [price, setPrice] = useState("")
  const [duration, setDuration] = useState("")
  const [emoji, setEmoji] = useState("💼")
  const [desc, setDesc] = useState("")
  const [saving, setSaving] = useState(false)
  const [snack, setSnack] = useState<{ visible: boolean; msg: string }>({ visible: false, msg: "" })

  const isValid = name.trim().length >= 2 && Number(price) > 0 && Number(duration) > 0

  const save = async () => {
    if (!isValid) return
    setSaving(true)
    try {
      await createService({
        name: name.trim(),
        price: Math.max(0, parseInt(price, 10) || 0),     // whole KSh
        duration: Math.max(0, parseInt(duration, 10) || 0), // minutes
        // category/emoji/desc optional for now
      })
      setSnack({ visible: true, msg: "Service created" })
      setTimeout(() => router.replace(".."), 350)
    } catch (e: any) {
      setSnack({
        visible: true,
        msg: e?.response?.data?.error || e?.message || "Failed to create service",
      })
      Sentry.Native.captureException(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => router.back()} />
        <Text style={styles.title}>Add Service</Text>
      </View>

      <Surface style={styles.card} elevation={2}>
        <TextInput label="Service Name *" mode="outlined" value={name} onChangeText={setName} style={styles.input} />
        <TextInput label="Emoji" mode="outlined" value={emoji} onChangeText={setEmoji} style={styles.input} />
        <TextInput
          label="Price (KSh) *"
          mode="outlined"
          value={price}
          onChangeText={setPrice}
          keyboardType="numeric"
          style={styles.input}
        />
        <TextInput
          label="Duration (minutes) *"
          mode="outlined"
          value={duration}
          onChangeText={setDuration}
          keyboardType="numeric"
          style={styles.input}
        />
        <TextInput
          label="Description"
          mode="outlined"
          value={desc}
          onChangeText={setDesc}
          multiline
          style={styles.input}
        />
      </Surface>

      <View style={styles.actions}>
        <Button mode="outlined" onPress={() => router.back()} style={styles.btn}>
          Cancel
        </Button>
        <Button mode="contained" onPress={save} disabled={!isValid || saving} loading={saving} style={styles.btn}>
          Save Service
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
  card: { backgroundColor: "#FFF", borderRadius: 12, padding: 16, marginHorizontal: 16 },
  input: { marginBottom: 12 },
  actions: { flexDirection: "row", gap: 12, paddingHorizontal: 16, marginTop: 12 },
  btn: { flex: 1 },
})