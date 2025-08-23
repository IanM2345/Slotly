"use client";

import { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import {
  Text,
  TextInput,
  Button,
  useTheme,
  Surface,
  IconButton,
  ProgressBar,
  SegmentedButtons,
} from "react-native-paper";
import * as DocumentPicker from "expo-document-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useOnboarding, type OnboardingData } from "../../../context/OnboardingContext";
import { uploadToCloudinaryAdvanced } from "../../../lib/upload/cloudinary";

/**
 * You can let the user choose *which* doc they're uploading.
 * Default is BUSINESS_LICENSE to keep your current UX intact.
 */
type KraDocType = "BUSINESS_LICENSE" | "KRA_PIN" | "REG_CERT";

export default function UploadDocs() {
  const theme = useTheme();
  const router = useRouter();
  const { data, setData, addAttachment, completeSection } = useOnboarding();

  const [kraPin, setKraPin] = useState(data.kraPin || "");
  const [regNumber, setRegNumber] = useState(data.regNumber || "");
  const [docType, setDocType] = useState<KraDocType>("BUSINESS_LICENSE");
  const [uploadedUrl, setUploadedUrl] = useState<string | undefined>(
    // if you previously stored a licenseUrl in data, show it
    data.licenseUrl
  );

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  const pickAndUpload = async () => {
    setErr(null);
    setProgress(0);

    const res = await DocumentPicker.getDocumentAsync({
      multiple: false,
      copyToCacheDirectory: true,
      type: ["application/pdf", "image/*"],
    });
    if (res.canceled || !res.assets?.[0]) return;

    try {
      setUploading(true);
      const fileUri = res.assets[0].uri;

      const result = await uploadToCloudinaryAdvanced(fileUri, {
        folder: "slotly/business-docs",
        tags: ["business", "license", "kra"],
        onProgress: (p) => setProgress(p),
      });

      // 1) keep a local preview
      setUploadedUrl(result.secure_url);

      // 2) normalize into attachments so later steps can read it
      addAttachment({
        type: docType,                  // "BUSINESS_LICENSE" | "KRA_PIN" | "REG_CERT"
        url: result.secure_url,
        step: 3,
        uploadedAt: Date.now(),
      });
    } catch (e: any) {
      setErr(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    // basic validation
    if (!kraPin.trim() || !regNumber.trim() || !uploadedUrl) {
      setErr("KRA PIN, Reg. Number, and a file are required.");
      return;
    }

    // 1) keep the raw fields in the context for easy display/edit later
    const updates: Partial<OnboardingData> = {
      kraPin: kraPin.trim(),
      regNumber: regNumber.trim(),
    };
    
    if (docType === "BUSINESS_LICENSE") {
      updates.licenseUrl = uploadedUrl;
    }
    
    setData(updates);

    // 2) mark section 'kra' complete - only include properties that match the expected type
    completeSection("kra", {
      done: true,
    });

    router.back();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <View style={styles.header}>
          <IconButton icon="arrow-left" size={22} onPress={() => router.back()} />
          <Text variant="headlineSmall" style={{ fontWeight: "700" }}>
            KRA / Registration Docs
          </Text>
        </View>

        <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <Text variant="titleMedium" style={[styles.label, { color: theme.colors.primary }]}>
            KRA PIN
          </Text>
          <TextInput
            mode="outlined"
            value={kraPin}
            onChangeText={setKraPin}
            placeholder="A1B2C3D4E5"
            style={styles.input}
            autoCapitalize="characters"
          />

          <Text variant="titleMedium" style={[styles.label, { color: theme.colors.primary }]}>
            Registration / Certificate Number
          </Text>
          <TextInput
            mode="outlined"
            value={regNumber}
            onChangeText={setRegNumber}
            placeholder="BN/123456"
            style={styles.input}
            autoCapitalize="characters"
          />

          {/* Optional: let the user decide which doc this file represents */}
          <Text variant="titleMedium" style={[styles.label, { color: theme.colors.primary }]}>
            Document Type
          </Text>
          <SegmentedButtons
            value={docType}
            onValueChange={(v) => setDocType(v as KraDocType)}
            buttons={[
              { value: "BUSINESS_LICENSE", label: "License" },
              { value: "KRA_PIN", label: "KRA PIN Doc" },
              { value: "REG_CERT", label: "Reg. Cert." },
            ]}
            style={{ marginBottom: 8 }}
          />

          <Text variant="titleMedium" style={[styles.label, { color: theme.colors.primary }]}>
            Upload File (PDF or Image)
          </Text>
          <Button
            mode="outlined"
            onPress={pickAndUpload}
            loading={uploading}
            disabled={uploading}
            style={{ marginBottom: 8 }}
          >
            {uploadedUrl ? "Replace file" : "Pick & upload"}
          </Button>

          {uploading ? (
            <View style={{ marginTop: 8, marginBottom: 4 }}>
              <ProgressBar progress={progress / 100} />
              <Text variant="bodySmall" style={{ marginTop: 4 }}>{progress}%</Text>
            </View>
          ) : null}

          {uploadedUrl ? (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Uploaded: {uploadedUrl}
            </Text>
          ) : null}

          {err ? <Text style={{ color: theme.colors.error, marginTop: 8 }}>{err}</Text> : null}

          <Button
            mode="contained"
            onPress={handleSave}
            style={[styles.saveBtn, { backgroundColor: "#FBC02D" }]}
            labelStyle={{ color: theme.colors.primary, fontWeight: "700" }}
          >
            Save
          </Button>
        </Surface>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  card: { borderRadius: 16, padding: 16, gap: 10 },
  label: { fontWeight: "700", marginTop: 6 },
  input: { backgroundColor: "transparent" },
  saveBtn: { borderRadius: 26, marginTop: 8 },
});