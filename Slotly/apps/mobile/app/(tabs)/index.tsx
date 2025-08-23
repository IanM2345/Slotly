import React, { useState } from 'react';
import { View, ScrollView, Image, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import SearchBar from '../components/ui/SearchBar';
import SectionHeader from '../components/ui/SectionHeader';
import Chip from '../components/ui/Chip';
import UICard from '../components/ui/Card';
import ActionButton from '../components/ui/ActionButton';

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState('');

  const popular = ['Haircut', 'Manicure', 'Massage', 'Makeup', 'Barber', 'Spa'];
  const nearYou = [
    { id: 1, name: 'Bella Salon', distance: '1.2 km', image: 'https://via.placeholder.com/220x120.png?text=Bella' },
    { id: 2, name: 'Gents Barber', distance: '2.0 km', image: 'https://via.placeholder.com/220x120.png?text=Gents' },
    { id: 3, name: 'Spa Relax', distance: '2.5 km', image: 'https://via.placeholder.com/220x120.png?text=Spa' },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={{ height: 12 }} />
      <SearchBar placeholder="Search services or institutions" value={query} onChangeText={setQuery} onPressFilters={() => router.push('/filters' as any)} />

      {/* Carousel / Banner */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, gap: 12 }}
      >
        {[1, 2, 3].map((i) => (
          <UICard key={i} style={{ width: 280, overflow: 'hidden' }}>
            <Image source={{ uri: `https://via.placeholder.com/280x140.png?text=Banner+${i}` }} style={{ width: '100%', height: 140 }} />
          </UICard>
        ))}
      </ScrollView>

      {/* Popular Services */}
      <SectionHeader title="Popular Services" actionLabel="See all" onActionPress={() => router.push('/(tabs)/explore' as any)} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
        {popular.map((p) => (
          <Chip key={p} onPress={() => router.push('/(tabs)/explore' as any)}>{p}</Chip>
        ))}
      </ScrollView>

      {/* Institutions Near You */}
      <SectionHeader title="Institutions Near You" actionLabel="View map" onActionPress={() => router.push('/(tabs)/explore' as any)} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}> 
        {nearYou.map((item) => (
          <UICard key={item.id} style={{ width: 220, overflow: 'hidden' }}>
            <Image source={{ uri: item.image }} style={{ width: '100%', height: 120 }} />
            <View style={{ padding: 12 }}>
              <Text variant="titleSmall" style={{ fontWeight: '700' }}>{item.name}</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{item.distance}</Text>
            </View>
          </UICard>
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
        <ActionButton onPress={() => router.push({ pathname: '/(tabs)/explore' } as any)}>Book a Service</ActionButton>
      </View>

      <View style={{ height: 16 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hScroll: { paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
});
