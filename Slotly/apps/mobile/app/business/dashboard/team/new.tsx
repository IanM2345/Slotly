"use client";

import React, { useMemo, useState } from "react";
import { View, ScrollView } from "react-native";
import { Text, TextInput, Button, HelperText, Snackbar, useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import { addStaffEnrollment } from "../../../../lib/api/modules/manager";
import { useSession } from "../../../../context/SessionContext";

export default function TeamNew() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useSession();
  const businessId = user?.business?.id;
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [userId, setUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState<{ visible: boolean; msg: string }>({ 
    visible: false, 
    msg: "" 
  });

  const isValid = useMemo(() => {
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(userId.trim());
    return first.trim().length > 0 && 
           last.trim().length > 0 && 
           userId.trim().length === 24 &&
           isValidObjectId;
  }, [first, last, userId]);

  const save = async () => {
    if (!isValid) return;
    setSaving(true);
    
    try {
      await addStaffEnrollment({
        userId: userId.trim(),
        firstName: first.trim(),
        lastName: last.trim(),
        businessId,
      });
      setSaving(false);
      setSnack({ visible: true, msg: "Application sent for approval" });
      setTimeout(() => router.back(), 300);
    } catch (error: any) {
      setSaving(false);
      const errorMsg = error?.response?.data?.error || "Failed to add staff member";
      setSnack({ visible: true, msg: errorMsg });
    }
  };

  return (
    <ScrollView 
      style={{ flex: 1, backgroundColor: theme.colors.background }} 
      contentContainerStyle={{ padding: 16, gap: 16 }}
    >
      <View style={{ paddingTop: 40, paddingBottom: 20 }}>
        <Text style={{ fontSize: 24, fontWeight: "bold", color: "#1559C1" }}>
          Add New Staff
        </Text>
      </View>

      <View style={{ backgroundColor: "#FFF", borderRadius: 12, padding: 16, gap: 12 }}>
        <TextInput
          mode="outlined"
          label="First Name"
          value={first}
          onChangeText={setFirst}
          placeholder="Enter first name"
        />
        
        <TextInput
          mode="outlined"
          label="Last Name"
          value={last}
          onChangeText={setLast}
          placeholder="Enter last name"
        />
        
        <TextInput
          mode="outlined"
          label="User ID"
          value={userId}
          onChangeText={setUserId}
          placeholder="Enter valid MongoDB ObjectId (24 hex characters)"
          maxLength={24}
        />

        <HelperText type={userId.length > 0 && !/^[0-9a-fA-F]{24}$/.test(userId) ? "error" : "info"}>
          {userId.length > 0 && !/^[0-9a-fA-F]{24}$/.test(userId) 
            ? "Invalid format. Must be exactly 24 hexadecimal characters."
            : "This will create a pending staff enrollment for approval."
          }
        </HelperText>
        
        <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
          <Button 
            mode="outlined" 
            onPress={() => router.back()} 
            style={{ flex: 1 }}
          >
            Cancel
          </Button>
          <Button 
            mode="contained" 
            onPress={save} 
            disabled={!isValid || saving}
            loading={saving}
            style={{ flex: 1 }}
          >
            Send Application
          </Button>
        </View>
      </View>

      <Snackbar
        visible={snack.visible}
        onDismiss={() => setSnack({ visible: false, msg: "" })}
        duration={3000}
      >
        {snack.msg}
      </Snackbar>
    </ScrollView>
  );
}