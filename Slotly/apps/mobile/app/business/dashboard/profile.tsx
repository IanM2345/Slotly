"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, ScrollView, StyleSheet, Alert, Image, TouchableOpacity, Platform } from "react-native";
import {
  Text,
  Surface,
  ActivityIndicator,
  IconButton,
  Button,
  Banner,
  TextInput,
  useTheme,
  Chip,
} from "react-native-paper";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import Constants from "expo-constants";

import { useSession } from "../../../context/SessionContext";
import { Section } from "../../../components/Section";

// API modules
import {
  getBusinessProfile,
  updateBusinessProfile,
} from "../../../lib/api/modules/manager";
import { uploadToCloudinary } from "../../../lib/api/modules/users";
import { placesAutocomplete, geocode, createDebouncedSearch } from "../../../lib/api/map";

type Suggestion = { description: string; place_id: string };

const MAX_DESCRIPTION_WORDS = 500;

export default function BusinessProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, updateBusiness } = useSession();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // image picked locally (to upload to Cloudinary)
  const [logoLocalUri, setLogoLocalUri] = useState<string | null>(null);

  // place autocomplete
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [fetchingPlaces, setFetchingPlaces] = useState(false);

  // Using the cleaner debounced search approach
  const searchPlaces = useRef(
    createDebouncedSearch(async (results: any) => {
      setSuggestions(Array.isArray(results) ? results : []);
      setFetchingPlaces(false);
    }, 250)
  ).current;

  const wordCount = useMemo(() => {
    return description.trim().split(/\s+/).filter(Boolean).length;
  }, [description]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getBusinessProfile();
        // backend returns the business object
        setName(data?.name || "");
        setDescription(data?.description || "");
        setAddress(data?.address || "");
        setLatitude(Number.isFinite(data?.latitude) ? data.latitude : null);
        setLongitude(Number.isFinite(data?.longitude) ? data.longitude : null);
        setLogoUrl(data?.logoUrl || null);
      } catch (e: any) {
        setError(e?.message || "Failed to load business profile");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // autocomplete with cleaner debounced search
  useEffect(() => {
    if (!query) {
      setSuggestions([]);
      return;
    }
    setFetchingPlaces(true);
    searchPlaces(query, { types: "establishment" });
  }, [query, searchPlaces]);

  const onPickLogo = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "We need access to your photos to set a logo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      quality: 0.9,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: false,
    });
    if (!result.canceled && result.assets?.length) {
      const uri = result.assets[0].uri;
      setLogoLocalUri(uri);
    }
  }, []);

  const onSuggestionPress = useCallback(async (s: Suggestion) => {
    try {
      setAddress(s.description);
      setQuery("");
      setSuggestions([]);
      // Fixed geocode call and response handling
      const g = await geocode({ place_id: s.place_id });
      const lat = g?.location?.lat;
      const lng = g?.location?.lng;
      if (typeof lat === "number" && typeof lng === "number") {
        setLatitude(lat);
        setLongitude(lng);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const onSave = useCallback(async () => {
    try {
      if (!name.trim()) {
        Alert.alert("Missing name", "Please enter a business name.");
        return;
      }
      if (wordCount > MAX_DESCRIPTION_WORDS) {
        Alert.alert("Too long", `Description must be ${MAX_DESCRIPTION_WORDS} words or less.`);
        return;
      }

      setSaving(true);
      setError(null);

      const payload: any = {
        name: name.trim(),
        description: description.trim(),
        address: address.trim(),
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
      };

      // Upload picked image to Cloudinary (unsigned), then save resulting URL
      if (logoLocalUri) {
        const CLOUD_NAME =
          process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ||
          (Constants?.expoConfig?.extra as any)?.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
        const UPLOAD_PRESET =
          process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ||
          (Constants?.expoConfig?.extra as any)?.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

        if (!CLOUD_NAME || !UPLOAD_PRESET) {
          throw new Error("Missing Cloudinary config (cloud name / preset)");
        }

        const uploadedUrl = await uploadToCloudinary({
          fileUri: logoLocalUri,
          uploadPreset: UPLOAD_PRESET,
          cloudName: CLOUD_NAME,
        });

        payload.logoUrl = uploadedUrl;
      } else if (logoUrl) {
        payload.logoUrl = logoUrl;
      }

      const updated = await updateBusinessProfile(payload);
      setSavedMsg("Profile updated");

      // update SessionContext – ensure context has the new logo
      updateBusiness?.({
        id: updated?.id,
        businessName: updated?.name,
        logoUrl: updated?.logoUrl,   // 👈 ensure context has the new logo
      } as any);

      // reflect logo URL returned by backend
      if (updated?.logoUrl) setLogoUrl(updated.logoUrl);
      if (logoLocalUri) setLogoLocalUri(null);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }, [name, description, address, latitude, longitude, logoLocalUri, logoUrl, wordCount, updateBusiness]);

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <IconButton icon="arrow-left" size={24} onPress={() => router.back()} />
        <Text style={styles.title}>Business Profile</Text>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator />
          <Text style={{ marginTop: 10, color: "#6B7280" }}>Loading…</Text>
        </View>
      ) : (
        <>
          {error && (
            <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
              <Banner visible icon="alert">
                {error}
              </Banner>
            </View>
          )}
          {savedMsg && (
            <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
              <Banner visible icon="check" actions={[{ label: "Close", onPress: () => setSavedMsg(null) }]}>
                {savedMsg}
              </Banner>
            </View>
          )}

          <Section title="Logo">
            <Surface style={styles.logoCard} elevation={1}>
              <TouchableOpacity onPress={onPickLogo} activeOpacity={0.9} style={styles.logoTouch}>
                {logoLocalUri ? (
                  <Image source={{ uri: logoLocalUri }} style={styles.logoImg} />
                ) : logoUrl ? (
                  <Image source={{ uri: logoUrl }} style={styles.logoImg} />
                ) : (
                  <View style={styles.logoPlaceholder}>
                    <Text style={styles.logoEmoji}>🏷️</Text>
                    <Text style={styles.logoHint}>Tap to upload logo</Text>
                  </View>
                )}
              </TouchableOpacity>
              {!!logoUrl && (
                <TextInput
                  mode="outlined"
                  label="Logo URL (optional)"
                  value={logoUrl}
                  onChangeText={setLogoUrl}
                  style={{ marginTop: 12 }}
                  right={<TextInput.Icon icon="link" />}
                />
              )}
              <Button onPress={onPickLogo} mode="text" style={{ marginTop: 8 }} icon="image">
                Choose Image
              </Button>
            </Surface>
          </Section>

          <Section title="Basic info">
            <View style={{ paddingHorizontal: 16, gap: 12 }}>
              <TextInput
                mode="outlined"
                label="Business name"
                value={name}
                onChangeText={setName}
              />
              <TextInput
                mode="outlined"
                label={`Description (${wordCount}/${MAX_DESCRIPTION_WORDS} words)`}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={5}
              />
            </View>
          </Section>

          <Section title="Location">
            <View style={{ paddingHorizontal: 16, gap: 12 }}>
              <TextInput
                mode="outlined"
                label="Address"
                value={address}
                onChangeText={(t) => {
                  setAddress(t);
                  setQuery(t);
                }}
                right={fetchingPlaces ? <TextInput.Icon icon="progress-clock" /> : undefined}
              />

              {/* suggestions */}
              {suggestions.length > 0 && (
                <Surface style={styles.suggestions} elevation={2}>
                  {suggestions.map((s) => (
                    <TouchableOpacity key={s.place_id} onPress={() => onSuggestionPress(s)} style={styles.suggestionRow}>
                      <Text>{s.description}</Text>
                    </TouchableOpacity>
                  ))}
                </Surface>
              )}

              <View style={{ flexDirection: "row", gap: 12 }}>
                <TextInput
                  mode="outlined"
                  label="Latitude"
                  value={latitude == null ? "" : String(latitude)}
                  onChangeText={(t) => setLatitude(t ? Number(t) : null)}
                  keyboardType="numeric"
                  style={{ flex: 1 }}
                />
                <TextInput
                  mode="outlined"
                  label="Longitude"
                  value={longitude == null ? "" : String(longitude)}
                  onChangeText={(t) => setLongitude(t ? Number(t) : null)}
                  keyboardType="numeric"
                  style={{ flex: 1 }}
                />
              </View>
              <Text style={{ color: "#6B7280" }}>Tip: choose from suggestions to auto-fill coordinates.</Text>
            </View>
          </Section>

          <View style={{ paddingHorizontal: 16, paddingVertical: 24 }}>
            <Button
              mode="contained"
              icon={saving ? "progress-check" : "content-save"}
              onPress={onSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingTop: 60, paddingBottom: 20 },
  title: { fontSize: 24, fontWeight: "bold", color: "#1559C1" },

  loading: { alignItems: "center", paddingTop: 60 },

  logoCard: { backgroundColor: "#fff", marginHorizontal: 16, padding: 16, borderRadius: 12, alignItems: "center" },
  logoTouch: { width: 112, height: 112, borderRadius: 56, overflow: "hidden" },
  logoImg: { width: "100%", height: "100%" },
  logoPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  logoEmoji: { fontSize: 28 },
  logoHint: { color: "#6B7280", marginTop: 8 },

  suggestions: { marginHorizontal: 0, borderRadius: 8, backgroundColor: "#fff" },
  suggestionRow: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E5E7EB" },
});