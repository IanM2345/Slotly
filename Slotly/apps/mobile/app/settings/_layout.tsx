import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { slotlyTheme } from '../theme/paper';

export default function SettingsLayout() {
  return (
    <PaperProvider theme={slotlyTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </PaperProvider>
  );
}