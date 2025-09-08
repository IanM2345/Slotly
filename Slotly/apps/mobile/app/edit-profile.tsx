import React, { useEffect, useState, useCallback } from "react";
import { View, ScrollView, StyleSheet, Alert } from "react-native";
import { Text, Avatar, Button, TextInput, IconButton, useTheme, Snackbar, Divider } from "react-native-paper";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { getMe, updateMe, uploadToCloudinary } from "../lib/api/modules/users";
import { useSession } from "../context/SessionContext";
import UICard from "./components/ui/Card";

type EditableUserData = {
  name: string;
  email: string;
  phone: string;
  avatarUrl?: string | null;
};

export default function EditProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { token, user: sessionUser, setUser } = useSession();

  const [form, setForm] = useState<EditableUserData>({
    name: sessionUser?.name || "",
    email: sessionUser?.email || "",
    phone: sessionUser?.phone || "",
    avatarUrl: sessionUser?.avatarUrl || null,
  });

  const [localImage, setLocalImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState<{ visible: boolean; msg: string }>({ visible: false, msg: "" });

  // Preload fresh profile (so fields are instantly ready)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const me = await getMe(token);
        if (!mounted) return;
        setForm({
          name: me?.name || "",
          email: me?.email || "",
          phone: me?.phone || "",
          avatarUrl: me?.avatarUrl || null,
        });
      } catch (e: any) {
        console.log("getMe failed", e?.message);
      }
    })();
    return () => { mounted = false; };
  }, [token]);

  const pickImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission required", "Please allow photo library access to change your avatar.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ImagePicker.MediaTypeOptions.Images, 
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!res.canceled && res.assets?.[0]?.uri) {
      setLocalImage(res.assets[0].uri);
    }
  }, []);

  // Helper function to navigate to profile tab
  const navigateToProfile = useCallback(() => {
    router.replace("/(tabs)/profile");
  }, [router]);

  const onSave = useCallback(async () => {
    if (!form.email?.trim()) {
      setSnack({ visible: true, msg: "Email is required" });
      return;
    }
    if (!form.phone?.trim()) {
      setSnack({ visible: true, msg: "Phone is required" });
      return;
    }

    try {
      setSaving(true);

      // 1) Upload avatar if changed locally
      let avatarUrl = form.avatarUrl || null;
      if (localImage) {
        const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
        const uploadPreset = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
        
        if (!cloudName || !uploadPreset) {
          throw new Error("Cloudinary configuration missing");
        }
        
        avatarUrl = await uploadToCloudinary({ 
          fileUri: localImage, 
          cloudName, 
          uploadPreset 
        });
      }

      // 2) Save to backend
      const updated = await updateMe(
        { name: form.name, phone: form.phone, avatarUrl },
        token
      );

      // 3) Update session cache so Home/Profile reflect instantly
      setUser?.(updated);

      setSnack({ visible: true, msg: "Profile updated" });
      
      // Navigate to profile tab after a delay to show the success message
      setTimeout(() => {
        navigateToProfile();
      }, 1500);
      
    } catch (e: any) {
      Alert.alert("Save failed", e?.message || "Unable to save profile");
    } finally {
      setSaving(false);
    }
  }, [form, localImage, token, navigateToProfile, setUser]);

  const handleCancel = () => {
    if (localImage || 
        form.name !== (sessionUser?.name || "") || 
        form.phone !== (sessionUser?.phone || "")) {
      Alert.alert(
        "Discard Changes",
        "You have unsaved changes. Are you sure you want to go back?",
        [
          { text: "Keep Editing", style: "cancel" },
          { 
            text: "Discard", 
            style: "destructive",
            onPress: navigateToProfile
          },
        ]
      );
    } else {
      navigateToProfile();
    }
  };

  const displayAvatar = localImage || form.avatarUrl || "https://via.placeholder.com/96?text=You";

  return (
    <ScrollView 
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <IconButton icon="close" onPress={handleCancel} />
        <Text variant="titleMedium" style={{ fontWeight: "700" }}>Edit Profile</Text>
        <View style={{ width: 48 }} />
      </View>

      {/* Avatar Section */}
      <UICard style={{ marginHorizontal: 16, padding: 16, alignItems: "center", marginBottom: 16 }}>
        <View style={{ position: "relative" }}>
          <Avatar.Image size={96} source={{ uri: displayAvatar }} />
          {localImage && (
            <View style={{
              position: "absolute",
              top: -5,
              right: -5,
              backgroundColor: "#22c55e",
              borderRadius: 12,
              width: 24,
              height: 24,
              justifyContent: "center",
              alignItems: "center",
            }}>
              <Text style={{ color: "white", fontSize: 12 }}>✓</Text>
            </View>
          )}
        </View>
        <Button mode="text" onPress={pickImage} style={{ marginTop: 8 }}>
          {localImage ? "Change photo again" : "Change photo"}
        </Button>
        {localImage && (
          <Text style={{ 
            fontSize: 12, 
            color: theme.colors.onSurfaceVariant, 
            textAlign: "center", 
            marginTop: 4 
          }}>
            New photo ready to save
          </Text>
        )}
      </UICard>

      {/* Form Section */}
      <UICard style={{ marginHorizontal: 16, marginBottom: 16 }}>
        <View style={{ padding: 16 }}>
          <Text 
            variant="titleMedium" 
            style={{ 
              fontWeight: "700", 
              color: theme.colors.primary, 
              marginBottom: 16 
            }}
          >
            Personal Information
          </Text>

          <TextInput
            label="Full name"
            value={form.name}
            onChangeText={(name) => setForm((s) => ({ ...s, name }))}
            style={{ marginBottom: 12 }}
            mode="outlined"
            left={<TextInput.Icon icon="account" />}
          />
          
          <TextInput
            label="Email"
            value={form.email}
            disabled
            style={{ marginBottom: 12 }}
            mode="outlined"
            left={<TextInput.Icon icon="email" />}
            right={<TextInput.Icon icon="lock" />}
          />
          
          <TextInput
            label="Phone"
            value={form.phone}
            onChangeText={(phone) => setForm((s) => ({ ...s, phone }))}
            keyboardType="phone-pad"
            mode="outlined"
            left={<TextInput.Icon icon="phone" />}
          />
        </View>
      </UICard>

      {/* Additional Options */}
      <UICard style={{ marginHorizontal: 16, marginBottom: 24 }}>
        <View style={{ padding: 16 }}>
          <Text 
            variant="titleMedium" 
            style={{ 
              fontWeight: "700", 
              color: theme.colors.primary, 
              marginBottom: 16 
            }}
          >
            Account Settings
          </Text>

          <Button
            mode="outlined"
            onPress={() => router.push("/settings/change-password")}
            style={{ marginBottom: 12 }}
            icon="lock"
          >
            Change Password
          </Button>

          <Divider style={{ marginVertical: 12 }} />

          <Button
            mode="text"
            onPress={() => setSnack({ visible: true, msg: "Account deletion available in profile settings" })}
            textColor={theme.colors.error}
            icon="delete"
          >
            Delete Account
          </Button>
        </View>
      </UICard>

      <View style={styles.actionButtons}>
        <Button 
          mode="outlined" 
          onPress={handleCancel}
          style={{ flex: 1, marginRight: 8 }}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button 
          mode="contained" 
          loading={saving} 
          onPress={onSave}
          style={{ flex: 1, marginLeft: 8 }}
          disabled={saving}
        >
          Save changes
        </Button>
      </View>

      <Snackbar 
        visible={snack.visible} 
        onDismiss={() => setSnack({ visible: false, msg: "" })}
        duration={2200}
      >
        {snack.msg}
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center", 
    paddingHorizontal: 8, 
    paddingTop: 16, 
    paddingBottom: 8 
  },
  actionButtons: { 
    flexDirection: "row", 
    paddingHorizontal: 16, 
    gap: 8 
  },
});