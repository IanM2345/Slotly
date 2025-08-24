import React, { useState } from "react";
import { View, ScrollView, StyleSheet, Alert } from "react-native";
import {
  Text,
  Avatar,
  Button,
  TextInput,
  IconButton,
  useTheme,
  Snackbar,
  Divider,
} from "react-native-paper";
import { useRouter } from "expo-router";
import UICard from "./components/ui/Card";

type EditableUserData = {
  name: string;
  email: string;
  phone: string;
  profileImage?: string;
};

export default function EditProfileScreen() {
  const theme = useTheme();
  const router = useRouter();

  // Initial data (in real app, this would come from your state management/API)
  const [formData, setFormData] = useState<EditableUserData>({
    name: "John Doe",
    email: "john.doe@email.com",
    phone: "+254 712 345 678",
    profileImage: "https://via.placeholder.com/150x150.png?text=JD",
  });

  const [originalData] = useState<EditableUserData>({
    name: "John Doe",
    email: "john.doe@email.com",
    phone: "+254 712 345 678",
    profileImage: "https://via.placeholder.com/150x150.png?text=JD",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [snack, setSnack] = useState<{ visible: boolean; msg: string }>({ 
    visible: false, 
    msg: "" 
  });

  const hasChanges = () => {
    return (
      formData.name !== originalData.name ||
      formData.email !== originalData.email ||
      formData.phone !== originalData.phone
    );
  };

  const handleSave = async () => {
    if (!hasChanges()) {
      setSnack({ visible: true, msg: "No changes to save" });
      return;
    }

    // Basic validation
    if (!formData.name.trim()) {
      setSnack({ visible: true, msg: "Name is required" });
      return;
    }

    if (!formData.email.trim()) {
      setSnack({ visible: true, msg: "Email is required" });
      return;
    }

    if (!formData.phone.trim()) {
      setSnack({ visible: true, msg: "Phone is required" });
      return;
    }

    setIsLoading(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // In real app, you would call your API here
      // await updateUserProfile(formData);
      
      setSnack({ visible: true, msg: "Profile updated successfully!" });
      
      // Navigate back after a short delay
      setTimeout(() => {
        router.back();
      }, 1500);
      
    } catch (error) {
      setSnack({ visible: true, msg: "Failed to update profile" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges()) {
      Alert.alert(
        "Discard Changes",
        "You have unsaved changes. Are you sure you want to go back?",
        [
          { text: "Keep Editing", style: "cancel" },
          { 
            text: "Discard", 
            style: "destructive",
            onPress: () => router.back()
          },
        ]
      );
    } else {
      router.back();
    }
  };

  const changeProfilePicture = () => {
    Alert.alert(
      "Change Profile Picture",
      "Select an option",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Camera", onPress: () => setSnack({ visible: true, msg: "Camera feature coming soon" }) },
        { text: "Gallery", onPress: () => setSnack({ visible: true, msg: "Gallery feature coming soon" }) },
      ]
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <IconButton 
          icon="close" 
          size={24} 
          onPress={handleCancel}
        />
        <Text variant="titleLarge" style={{ fontWeight: "700", color: theme.colors.primary }}>
          Edit Profile
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Profile Picture Section */}
      <UICard style={{ marginHorizontal: 16, marginBottom: 16, padding: 16 }}>
        <View style={{ alignItems: "center", marginBottom: 16 }}>
          <View style={{ position: "relative" }}>
            <Avatar.Image 
              size={100} 
              source={{ uri: formData.profileImage }} 
            />
            <IconButton
              icon="camera"
              size={20}
              mode="contained"
              style={{
                position: "absolute",
                bottom: -5,
                right: -5,
                backgroundColor: theme.colors.primary,
              }}
              iconColor="white"
              onPress={changeProfilePicture}
            />
          </View>
          <Text 
            variant="bodyMedium" 
            style={{ 
              color: theme.colors.primary, 
              marginTop: 8,
              fontWeight: "600" 
            }}
          >
            Tap to change photo
          </Text>
        </View>
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
            label="Full Name"
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            mode="outlined"
            style={{ marginBottom: 16 }}
            left={<TextInput.Icon icon="account" />}
          />

          <TextInput
            label="Email Address"
            value={formData.email}
            onChangeText={(text) => setFormData({ ...formData, email: text })}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            style={{ marginBottom: 16 }}
            left={<TextInput.Icon icon="email" />}
          />

          <TextInput
            label="Phone Number"
            value={formData.phone}
            onChangeText={(text) => setFormData({ ...formData, phone: text })}
            mode="outlined"
            keyboardType="phone-pad"
            style={{ marginBottom: 16 }}
            left={<TextInput.Icon icon="phone" />}
          />
        </View>
      </UICard>

      {/* Additional Settings */}
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
            onPress={() => setSnack({ visible: true, msg: "Password change feature coming soon" })}
            style={{ marginBottom: 12 }}
            icon="lock"
          >
            Change Password
          </Button>

          <Divider style={{ marginVertical: 12 }} />

          <Button
            mode="text"
            onPress={() => setSnack({ visible: true, msg: "Account deletion feature coming soon" })}
            textColor={theme.colors.error}
            icon="delete"
          >
            Delete Account
          </Button>
        </View>
      </UICard>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <Button
          mode="outlined"
          onPress={handleCancel}
          style={{ flex: 1, marginRight: 8 }}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          mode="contained"
          onPress={handleSave}
          style={{ flex: 1, marginLeft: 8 }}
          loading={isLoading}
          disabled={isLoading || !hasChanges()}
        >
          Save Changes
        </Button>
      </View>

      <Snackbar
        visible={snack.visible}
        onDismiss={() => setSnack({ visible: false, msg: "" })}
        duration={2200}
        style={{ marginHorizontal: 16, marginTop: 10 }}
      >
        {snack.msg}
      </Snackbar>

      <View style={{ height: 40 }} />
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
    paddingBottom: 8,
  },
  actionButtons: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
  },
});