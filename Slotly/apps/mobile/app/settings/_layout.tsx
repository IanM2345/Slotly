import { Stack } from 'expo-router';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, // ✅ Hides the white header across all subpages in settings/
      }}
    />
  );
}