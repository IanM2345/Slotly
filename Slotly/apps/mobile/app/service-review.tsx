// apps/mobile/app/service-review.tsx
import React, { useMemo, useState } from "react";
import { View, ScrollView, StyleSheet, TouchableOpacity, Image } from "react-native";
import { Text, Surface, IconButton, TextInput, Button, useTheme, Snackbar } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useSession } from "../context/SessionContext";
import { createOrUpdateReview, uploadToCloudinary } from "../lib/api/modules/users";

const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET; // "Business Registartion"

export default function ServiceReviewScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { token } = useSession();
  const { bookingId, businessId, businessName } = useLocalSearchParams<{ bookingId?: string; businessId?: string; businessName?: string }>();

  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState<{ visible: boolean; msg: string }>({ visible: false, msg: "" });

  const canSubmit = useMemo(() => !!token && rating > 0 && !loading && (!!bookingId || !!businessId), [token, rating, loading, bookingId, businessId]);

  const handleBack = () => router.back();

  const pickImage = async () => {
    // Ask camera roll permission lazily
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setSnack({ visible: true, msg: "Permission required to select a photo" });
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!res.canceled && res.assets?.[0]?.uri) setPhotoUri(res.assets[0].uri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      setSnack({ visible: true, msg: "Camera permission required" });
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      quality: 0.85,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!res.canceled && res.assets?.[0]?.uri) setPhotoUri(res.assets[0].uri);
  };

  const renderStars = () => {
    const xs = [];
    for (let i = 1; i <= 5; i++) {
      xs.push(
        <TouchableOpacity key={i} onPress={() => setRating(i)} style={styles.starButton} activeOpacity={0.7}>
          <Text style={[styles.star, { color: i <= rating ? "#FFD700" : "#DDD" }]}>★</Text>
        </TouchableOpacity>
      );
    }
    return xs;
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      let imageUrl: string | undefined;
      if (photoUri) {
        imageUrl = await uploadToCloudinary({
          fileUri: photoUri,
          uploadPreset: String(UPLOAD_PRESET),
          cloudName: String(CLOUD_NAME),
        });
      }

      await createOrUpdateReview(
        {
          bookingId: bookingId ? String(bookingId) : undefined,
          businessId: businessId ? String(businessId) : undefined,
          rating,
          comment: comment.trim(),
          imageUrl,
        },
      );

      setSnack({ visible: true, msg: "Review submitted" });
      setTimeout(() => router.back(), 900);
    } catch (e: any) {
      setSnack({ visible: true, msg: e?.message || "Failed to submit review" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton icon="arrow-left" size={24} onPress={handleBack} style={styles.backButton} />
        <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]} numberOfLines={1}>
          {businessName ? `Review ${businessName}` : "Leave a Review"}
        </Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Stars */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.colors.onSurface }]}>Rate your experience</Text>
          <View style={styles.starsContainer}>{renderStars()}</View>
        </View>

        {/* Comment */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.colors.onSurface }]}>Describe your experience</Text>
          <TextInput
            mode="outlined"
            value={comment}
            onChangeText={setComment}
            style={styles.reviewInput}
            outlineColor={theme.colors.outline}
            activeOutlineColor={theme.colors.primary}
            textColor={theme.colors.onSurface}
            multiline
            numberOfLines={6}
            placeholder="Add helpful details..."
            textAlignVertical="top"
          />
        </View>

        {/* Photo */}
        <View style={styles.section}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button mode="outlined" icon="camera" onPress={takePhoto}>Take photo</Button>
            <Button mode="outlined" icon="image" onPress={pickImage}>Choose from gallery</Button>
          </View>
          {!!photoUri && (
            <View style={{ marginTop: 12 }}>
              <Image source={{ uri: photoUri }} style={{ width: "100%", height: 180, borderRadius: 12 }} />
              <Text style={{ marginTop: 6, color: theme.colors.onSurfaceVariant }}>Will upload when you submit</Text>
            </View>
          )}
        </View>

        <View style={{ marginTop: 12 }}>
          <Button mode="contained" onPress={handleSubmit} disabled={!canSubmit} loading={loading} style={styles.saveButton} contentStyle={styles.saveButtonContent}>
            Submit review
          </Button>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      <Snackbar visible={snack.visible} onDismiss={() => setSnack({ visible: false, msg: "" })} duration={2200}>
        {snack.msg}
      </Snackbar>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingTop: 16, paddingBottom: 16 },
  backButton: { marginRight: 8 },
  headerTitle: { fontSize: 22, fontWeight: "bold", flex: 1, textAlign: "center", marginRight: 48 },
  scrollView: { flex: 1, paddingHorizontal: 16 },
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
  starsContainer: { flexDirection: "row", justifyContent: "center", alignItems: "center", paddingVertical: 8, gap: 8 },
  starButton: { padding: 4 },
  star: { fontSize: 32, textShadowColor: "rgba(0, 0, 0, 0.1)", textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  reviewInput: { backgroundColor: "transparent", minHeight: 120 },
  saveButton: { borderRadius: 25 },
  saveButtonContent: { paddingVertical: 12 },
});
