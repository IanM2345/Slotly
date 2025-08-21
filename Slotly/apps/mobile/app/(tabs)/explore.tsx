// explore.tsx

import React, { useState } from 'react';
import { View, ScrollView, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, SegmentedButtons, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import SearchBar from '../components/ui/SearchBar';
import Chip from '../components/ui/Chip';
import UICard from '../components/ui/Card';

type Mode = 'institutions' | 'services';

export default function ExploreScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<Mode>('institutions');

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={{ height: 12 }} />
      <SearchBar placeholder="Search" value={query} onChangeText={setQuery} onPressFilters={() => router.push('/filters' as any)} />

      {/* Toggle */}
      <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
        <SegmentedButtons
          value={mode}
          onValueChange={(v) => setMode(v as Mode)}
          buttons={[
            { value: 'institutions', label: 'Institutions' },
            { value: 'services', label: 'Services' },
          ]}
          density="small"
          style={{ borderRadius: 12 }}
        />
      </View>

      {/* Top chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
        <Chip>Near me</Chip>
        <Chip>When?</Chip>
        <Chip>Open now</Chip>
        <Chip>Offers</Chip>
      </ScrollView>

      {mode === 'institutions' ? (
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          {[1, 2, 3, 4].map((i) => (
            <TouchableOpacity key={i} onPress={() => router.push(`/institution/${i}` as any)}>
              <UICard>
                <Image source={{ uri: 'https://via.placeholder.com/600x160.png?text=Institution' }} style={{ width: '100%', height: 140 }} />
                <View style={{ padding: 12 }}>
                  <Text variant="titleSmall" style={{ fontWeight: '700' }}>Bella Salon</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Nairobi · 1.2 km</Text>
                </View>
              </UICard>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <>
          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <TouchableOpacity key={i} onPress={() => router.push({ pathname: '/booking/service', params: { serviceId: String(i) } } as any)}>
                <UICard>
                  <Image source={{ uri: 'https://via.placeholder.com/600x160.png?text=Service' }} style={{ width: '100%', height: 140 }} />
                  <View style={{ padding: 12 }}>
                    <Text variant="titleSmall" style={{ fontWeight: '700' }}>Deluxe Haircut</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Bella Salon · KSh 1,500</Text>
                  </View>
                </UICard>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={{ marginTop: 16, marginBottom: 8, paddingHorizontal: 16, fontWeight: '800' }}>Popular in your area (12)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            {[1, 2, 3].map((i) => (
              <UICard key={i} style={{ width: 220, overflow: 'hidden' }}>
                <Image source={{ uri: 'https://via.placeholder.com/220x120.png?text=Popular' }} style={{ width: '100%', height: 120 }} />
                <View style={{ padding: 12 }}>
                  <Text variant="titleSmall" style={{ fontWeight: '700' }}>Beard Trim</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Gents Barber · KSh 800</Text>
                </View>
              </UICard>
            ))}
          </ScrollView>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hScroll: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
});
