"use client"

import { useState } from "react"
import { View, ScrollView, StyleSheet } from "react-native"
import { Text, Surface, TextInput, Button, RadioButton, Snackbar, IconButton, useTheme } from "react-native-paper"
import { useRouter } from "expo-router"
import { teamApi } from "../../../../lib/team/api"

export default function TeamNew() {
  const theme = useTheme()
  const router = useRouter()
  const [first, setFirst] = useState("")
  const [last, setLast] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [role, setRole] = useState<"Stylist" | "Therapist" | "Reception" | "Manager">("Stylist")
  const [saving, setSaving] = useState(false)
  const [snack, setSnack] = useState<{ visible: boolean; msg: string }>({ visible: false, msg: "" })

  const isValid = first.trim() && last.trim() && /\S+@\S+\.\S+/.test(email) && phone.trim()

  const save = async () => {
    if (!isValid) return
    setSaving(true)
    const newMember = await teamApi.create({ firstName: first, lastName: last, email, phone, role })
    setSaving(false)
    setSnack({ visible: true, msg: "Staff member added" })
    setTimeout(() => router.replace(`./${newMember.id}`), 350)
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => router.back()} />
        <Text style={styles.title}>Add Staff</Text>
      </View>

      <Surface style={styles.card} elevation={2}>
        <TextInput mode="outlined" label="First Name *" value={first} onChangeText={setFirst} style={styles.input} />
        <TextInput mode="outlined" label="Last Name *" value={last} onChangeText={setLast} style={styles.input} />
        <TextInput
          mode="outlined"
          label="Email *"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          style={styles.input}
        />
        <TextInput
          mode="outlined"
          label="Phone *"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          style={styles.input}
        />
        <Text style={{ fontWeight: "600", marginBottom: 6 }}>Role</Text>
        <RadioButton.Group onValueChange={(v) => setRole(v as any)} value={role}>
          <Radio v="Stylist" label="Stylist" />
          <Radio v="Therapist" label="Therapist" />
          <Radio v="Reception" label="Reception" />
          <Radio v="Manager" label="Manager" />
        </RadioButton.Group>
      </Surface>

      <View style={styles.actions}>
        <Button mode="outlined" onPress={() => router.back()} style={styles.btn}>
          Cancel
        </Button>
        <Button mode="contained" onPress={save} disabled={!isValid || saving} loading={saving} style={styles.btn}>
          Save
        </Button>
      </View>

      <Snackbar visible={snack.visible} onDismiss={() => setSnack({ visible: false, msg: "" })} duration={2500}>
        {snack.msg}
      </Snackbar>
    </ScrollView>
  )
}

function Radio({ v, label }: { v: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
      <RadioButton value={v} />
      <Text>{label}</Text>
    </View>
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
