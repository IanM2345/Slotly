"use client";

import { useState } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { Text, Button, Surface, useTheme, IconButton, TextInput } from "react-native-paper";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function OwnerDetails() {
  const router = useRouter();
  const theme = useTheme();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [email, setEmail] = useState("");

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={[styles.stepIndicator, { backgroundColor: theme.colors.primary }]}>
            <Text style={[styles.stepNumber, { color: theme.colors.onPrimary }]}>3</Text>
          </View>
          <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onBackground }]}>
            Owner / CEO Details
          </Text>
        </View>

        <View style={[styles.phoneBar, { backgroundColor: theme.colors.primary }]}>
          <Text style={[styles.timeText, { color: theme.colors.onPrimary }]}>9:41 AM</Text>
        </View>

        <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <View style={styles.formHeader}>
            <IconButton icon="arrow-left" size={20} iconColor={theme.colors.primary} onPress={() => router.back()} />
            <Text variant="titleLarge" style={[styles.formTitle, { color: theme.colors.primary }]}>
              Owner Details
            </Text>
          </View>

          <View style={styles.divider} />

          <TextInput mode="outlined" label="Full Name" value={name} onChangeText={setName} style={styles.input} />
          <TextInput mode="outlined" label="Phone Number" value={phone} onChangeText={setPhone} style={styles.input} keyboardType="phone-pad" />
          <TextInput mode="outlined" label="National ID / Passport" value={idNumber} onChangeText={setIdNumber} style={styles.input} />
          <TextInput mode="outlined" label="Official Email" value={email} onChangeText={setEmail} style={styles.input} keyboardType="email-address" />

          <Button
            mode="contained"
            onPress={() => router.push("/business/onboarding/kyc")}
            style={[styles.primary, { backgroundColor: "#FBC02D" }]}
            labelStyle={{ color: theme.colors.primary }}
          >
            Save & Back to KYC
          </Button>
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 20 },
  header: { alignItems: "center", marginBottom: 20 },
  stepIndicator: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  stepNumber: { fontSize: 18, fontWeight: "bold" },
  title: { fontWeight: "bold", textAlign: "center" },
  phoneBar: { height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", marginBottom: 20 },
  timeText: { fontSize: 16, fontWeight: "600" },
  card: { borderRadius: 20, padding: 24, marginBottom: 20 },
  formHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  formTitle: { fontWeight: "bold" },
  divider: { height: 2, backgroundColor: "#1559C1", marginBottom: 24 },
  input: { marginBottom: 12 },
  primary: { borderRadius: 25 },
});
