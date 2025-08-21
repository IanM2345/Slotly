// apps/mobile/app/business/dashboard/staff/_layout.tsx
"use client";

import { createContext, useContext, useState } from "react";
import { Stack, Redirect } from "expo-router";
import { Snackbar } from "react-native-paper";
import { useSession } from "../../../../context/SessionContext";
import { slotlyTheme } from "../../../../theme/paper";


interface ToastContextType {
  notify: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
};

export default function StaffLayout() {
  const { user } = useSession();

  // 🔒 guard
  if (!user) return <Redirect href="/login" />;
  if (user.accountType !== "staff") return <Redirect href="/" />;

  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  const notify = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  return (
    <ToastContext.Provider value={{ notify }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />          {/* ← add index explicitly */}
        <Stack.Screen name="profile" />
        <Stack.Screen name="availability" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="performance" />
        <Stack.Screen name="schedule" />
      </Stack>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={2500}
        style={{ marginBottom: 20 }}
      >
        {snackbarMessage}
      </Snackbar>
    </ToastContext.Provider>
  );
}
