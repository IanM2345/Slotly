import React from 'react';
import { View, ScrollView } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import UICard from '../components/ui/Card';
import Pill from '../components/ui/Pill';
import ActionButton from '../components/ui/ActionButton';
import { useRouter } from 'expo-router';

type Item = {
  id: string;
  status: 'Upcoming' | 'Finished' | 'Cancelled';
  service: string;
  staff: string;
  business: string;
  date: string;
  time: string;
};

const items: Item[] = [
  { id: 'a1', status: 'Upcoming', service: 'Deluxe Haircut', staff: 'Alex', business: 'Gents Barber', date: 'Aug 28, 2025', time: '3:00 PM' },
  { id: 'a2', status: 'Finished', service: 'Manicure', staff: 'Mary', business: 'Bella Salon', date: 'Aug 12, 2025', time: '1:00 PM' },
  { id: 'a3', status: 'Cancelled', service: 'Massage', staff: 'Sam', business: 'Spa Relax', date: 'Aug 05, 2025', time: '11:00 AM' },
];

export default function HistoryScreen() {
  const theme = useTheme();
  const router = useRouter();

  const upcoming = items.filter(i => i.status === 'Upcoming');
  const past = items.filter(i => i.status !== 'Upcoming');

  const renderItem = (it: Item) => (
    <UICard key={it.id} style={{ marginHorizontal: 16, marginBottom: 12 }}>
      <View style={{ padding: 12, flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Pill
            label={it.status}
            variant={it.status === 'Upcoming' ? 'success' : it.status === 'Cancelled' ? 'error' : 'default'}
          />
          <Text style={{ marginTop: 8, fontWeight: '800' }}>{it.service} · {it.staff}</Text>
          <Text style={{ color: theme.colors.onSurfaceVariant }}>{it.business}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', minWidth: 120 }}>
          <View style={{ borderWidth: 1, borderColor: theme.colors.outline, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 }}>
            <Text style={{ fontWeight: '800' }}>{it.date}</Text>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>{it.time}</Text>
          </View>
        </View>
      </View>
      {it.status !== 'Upcoming' && (
        <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
          <ActionButton variant="secondary" onPress={() => router.push({ pathname: '/booking/service', params: { serviceId: it.id } } as any)}>Book again</ActionButton>
        </View>
      )}
    </UICard>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}>
      <Text style={{ marginHorizontal: 16, marginBottom: 8, fontWeight: '800' }}>Upcoming</Text>
      {upcoming.map(renderItem)}

      <Text style={{ marginHorizontal: 16, marginTop: 16, marginBottom: 8, fontWeight: '800' }}>Finished / Cancelled</Text>
      {past.map(renderItem)}
    </ScrollView>
  );
}
