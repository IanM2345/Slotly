import React from 'react';
import { View, ScrollView } from 'react-native';
import { Text, useTheme, Icon } from 'react-native-paper';
import ListRow from '../components/ui/ListRow';
import ActionButton from '../components/ui/ActionButton';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function ConfirmationScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ serviceId?: string; date?: string; slot?: string }>();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <View style={{ alignItems: 'center', marginBottom: 12 }}>
          <Icon source="check-circle" size={72} color={(theme.colors as any).success} />
        </View>
        <Text variant="titleMedium" style={{ fontWeight: '800', marginBottom: 12, textAlign: 'center' }}>Booking Confirmed</Text>
        <ListRow label="Service" value={`Deluxe Haircut (#${params.serviceId ?? '1'})`} />
        <ListRow label="Date" value={params.date ? new Date(params.date).toLocaleString() : '—'} />
        <ListRow label="Time" value={params.slot ?? '—'} />
        <Text style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}>Add a reminder to your calendar</Text>

        <ActionButton style={{ marginTop: 16 }} onPress={() => router.replace('/(tabs)' as any)}>Ok, Got It</ActionButton>
      </View>
    </ScrollView>
  );
}


