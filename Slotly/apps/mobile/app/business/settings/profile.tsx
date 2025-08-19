"use client";

import { useEffect, useState } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import {
  Text,
  Surface,
  ActivityIndicator,
  IconButton,
  Button,
  TextInput,
  useTheme,
  Snackbar,
} from "react-native-paper";
import { useRouter } from "expo-router";
import { VerificationGate } from "../../../components/VerificationGate";
import { Section } from "../../../components/Section";

// ✅ use your existing manager API module that talks to /api/manager/me
import {
  getBusinessProfile,
  updateBusinessProfile,
} from "../../../lib/api/modules/manager"; // <— path matters

type ProfileState = {
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  // If you later persist a business "type", add it here too
  type?: string;
};

export default function BusinessProfileScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    try {
      // GET /api/manager/me -> returns business plus (now) phone/email from owner
      const b = await getBusinessProfile();
      const p: ProfileState = {
        name: b?.name ?? "",
        description: b?.description ?? "",
        address: b?.address ?? "",
        phone: b?.phone ?? "",
        email: b?.email ?? "",
        type: b?.type ?? "", // only shows if you add it to the schema later
      };
      setProfile(p);
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    try {
      // PUT /api/manager/me -> updates Business + (owner) User phone/email
      await updateBusinessProfile({
        name: profile.name,
        description: profile.description,
        address: profile.address,
        phone: profile.phone,   // updated on owner User
        email: profile.email,   // updated on owner User
        // type: profile.type,  // uncomment only if you add Business.type in schema
      });
      setSnackbarMessage("Profile updated successfully");
      setSnackbarVisible(true);
    } catch (error) {
      console.error("Error updating profile:", error);
      setSnackbarMessage("Failed to update profile");
      setSnackbarVisible(true);
    } finally {
      setSaving(false);
    }
  }

  const updateField = (field: keyof ProfileState, value: string) => {
    if (!profile) return;
    setProfile({ ...profile, [field]: value });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load profile</Text>
        <Button mode="contained" onPress={loadProfile}>
          Retry
        </Button>
      </View>
    );
  }

  return (
    <VerificationGate>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <IconButton icon="arrow-left" size={24} iconColor={theme.colors.onSurface} onPress={() => router.back()} />
          <Text style={styles.title}>Business Profile</Text>
        </View>

        <Section title="Business Profile">
          <Surface style={styles.formCard} elevation={2}>
            <TextInput
              mode="outlined"
              label="Business Name *"
              value={profile.name}
              onChangeText={(text) => updateField("name", text)}
              style={styles.input}
            />

            <TextInput
              mode="outlined"
              label="Business Type"
              value={profile.type ?? ""}
              onChangeText={(text) => updateField("type", text)}
              style={styles.input}
              placeholder="e.g., Beauty Salon"
            />

            <TextInput
              mode="outlined"
              label="Phone Number"
              value={profile.phone ?? ""}
              onChangeText={(text) => updateField("phone", text)}
              keyboardType="phone-pad"
              style={styles.input}
            />

            <TextInput
              mode="outlined"
              label="Email Address"
              value={profile.email ?? ""}
              onChangeText={(text) => updateField("email", text)}
              keyboardType="email-address"
              style={styles.input}
            />

            <TextInput
              mode="outlined"
              label="Business Description"
              value={profile.description ?? ""}
              onChangeText={(text) => updateField("description", text)}
              multiline
              numberOfLines={4}
              style={styles.input}
            />
          </Surface>
        </Section>

        <Section title="Location">
          <Surface style={styles.formCard} elevation={2}>
            <TextInput
              mode="outlined"
              label="Business Address"
              value={profile.address ?? ""}
              onChangeText={(text) => updateField("address", text)}
              multiline
              numberOfLines={3}
              style={styles.input}
            />
          </Surface>
        </Section>

        <View style={styles.actionContainer}>
          <Button
            mode="contained"
            onPress={handleSave}
            loading={saving}
            disabled={saving}
            style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
            icon="content-save"
          >
            Save Profile Changes
          </Button>
        </View>

        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={3000}
          action={{ label: "OK", onPress: () => setSnackbarVisible(false) }}
        >
          {snackbarMessage}
        </Snackbar>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </VerificationGate>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6B7280",
  },
  errorContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: "#C62828",
    marginBottom: 20,
    textAlign: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1559C1",
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 16,
  },
  input: {
    marginBottom: 16,
  },
  actionContainer: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  saveButton: {
    borderRadius: 25,
    paddingVertical: 4,
  },
  bottomSpacing: {
    height: 40,
  },
})