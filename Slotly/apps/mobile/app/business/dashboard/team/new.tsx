"use client";

import { useState } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { Text, Surface, TextInput, Button, Chip, Snackbar, IconButton, useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import { teamApi } from "../../../../lib/team/api";

const ROLE_SUGGESTIONS = ["Stylist", "Therapist", "Reception", "Manager", "Barber", "Technician"];

export default function TeamNew() {
  const theme = useTheme();
  const router = useRouter();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [userId, setUserId] = useState(""); // <- new
  const [role, setRole] = useState("");     // <- free-form
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState<{ visible: boolean; msg: string }>({ visible: false, msg: "" });

  const isValid = first.trim() && last.trim() && userId.trim().length >= 3 && role.trim().length >= 2;

  const save = async () => {
    if (!isValid) return;
    setSaving(true);
    const newMember = await teamApi.create({
      firstName: first.trim(),
      lastName: last.trim(),
      userId: userId.trim(),
      role: role.trim(),
    });
    setSaving(false);
    setSnack({ visible: true, msg: "Staff member added" });
    setTimeout(() => router.replace(`./${newMember.id}`), 350);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => router.back()} />
        <Text style={styles.title}>Add Staff</Text>
      </View>

      <Surface style={styles.card} elevation={2}>
        <TextInput mode="outlined" label="First Name *" value={first} onChangeText={setFirst} style={styles.input} />
        <TextInput mode="outlined" label="Last Name *" value={last} onChangeText={setLast} style={styles.input} />
        <TextInput mode="outlined" label="User ID *" value={userId} onChangeText={setUserId} style={styles.input}
          placeholder="The ID on the staff member's Slotly profile" />
        <TextInput mode="outlined" label="Role *" value={role} onChangeText={setRole} style={styles.input}
          placeholder="e.g., Senior Stylist" />

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
          {ROLE_SUGGESTIONS.map((r) => (
            <Chip key={r} onPress={() => setRole(r)} compact>{r}</Chip>
          ))}
        </View>
      </Surface>

      <View style={styles.actions}>
        <Button mode="outlined" onPress={() => router.back()} style={styles.btn}>Cancel</Button>
        <Button mode="contained" onPress={save} disabled={!isValid || saving} loading={saving} style={styles.btn}>Save</Button>
      </View>

      <Snackbar visible={snack.visible} onDismiss={() => setSnack({ visible: false, msg: "" })} duration={2500}>
        {snack.msg}
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingTop: 60, paddingBottom: 20 },
  title: { fontSize: 24, fontWeight: "bold", color: "#1559C1" },
  card: { backgroundColor: "#FFF", borderRadius: 12, padding: 16, marginHorizontal: 16 },
  input: { marginBottom: 12 },
  actions: { flexDirection: "row", gap: 12, paddingHorizontal: 16, marginTop: 12 },
  btn: { flex: 1 },
});
