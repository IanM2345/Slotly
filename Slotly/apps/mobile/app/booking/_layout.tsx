import React from 'react';
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { slotlyTheme } from '../theme/paper';

export default function BookingLayout() {
  return (
    <PaperProvider theme={slotlyTheme}>
      <Stack screenOptions={{ headerShown: false }} />
    </PaperProvider>
  );
}


