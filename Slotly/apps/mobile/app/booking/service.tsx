import React, { useState } from 'react';
import { View, ScrollView, Image } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import SearchBar from '../components/ui/SearchBar';
import UICard from '../components/ui/Card';
import ActionButton from '../components/ui/ActionButton';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function ServiceSelectionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ serviceId?: string }>();
  const serviceId = params.serviceId ?? '1';
  const [query, setQuery] = useState('');

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={{ height: 12 }} />
      <SearchBar placeholder="Search services" value={query} onChangeText={setQuery} />
      <View style={{ paddingHorizontal: 16, marginTop: 12, gap: 12 }}>
        {[1,2,3,4].map((i) => (
          <UICard key={i}>
            <Image source={{ uri: 'https://via.placeholder.com/600x160.png?text=Service' }} style={{ width: '100%', height: 140 }} />
            <View style={{ padding: 12 }}>
              <Text variant="titleSmall" style={{ fontWeight: '800' }}>Deluxe Haircut</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Bella Salon · KSh 1,500</Text>
            </View>
          </UICard>
        ))}
        <ActionButton onPress={() => router.push({ pathname: '/booking/date-time', params: { serviceId } } as any)}>
          Continue
        </ActionButton>
      </View>
    </ScrollView>
  );
}


