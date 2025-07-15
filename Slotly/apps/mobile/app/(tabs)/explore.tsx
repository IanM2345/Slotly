// explore.tsx

import React from 'react';
import { useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';

import { View, ScrollView, StyleSheet, Image } from 'react-native';
import { Text, TextInput, Chip, useTheme } from 'react-native-paper';

export default function ExploreScreen() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <ScrollView style={styles.container}>
      {/* Location Header */}
      <Text style={styles.locationText}>📍 Nairobi, Kenya</Text>

      {/* Search Bar */}
      <TextInput
        mode="outlined"
        placeholder="Search services..."
        style={styles.searchBar}
        left={<TextInput.Icon icon="magnify" />}
      />

      {/* Categories */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categories}>
        {['Hair', 'Nails', 'Barber', 'Massage', 'Spa', 'Makeup'].map((category, index) => (
          <Chip key={index} style={styles.chip} mode="outlined">
            {category}
          </Chip>
        ))}
      </ScrollView>

      {/* Featured Services */}
      <Text style={styles.sectionTitle}>Featured Services</Text>
      <View style={styles.cards}>
        {[1, 2, 3].map((id) => (
         <TouchableOpacity
  key={id}
  style={styles.card}
  onPress={() => router.push('/profile')}// 
>
  <Image
    source={{ uri: 'https://via.placeholder.com/150x100.png?text=Service+Image' }}
    style={styles.cardImage}
  />
  <Text style={styles.cardTitle}>Service Name</Text>
  <Text style={styles.cardSub}>Salon · KSh 1,500</Text>
</TouchableOpacity>

        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
  },
  locationText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  searchBar: {
    marginBottom: 20,
  },
  categories: {
    marginBottom: 24,
  },
  chip: {
    marginRight: 10,
    backgroundColor: '#ffc0cb', // Light pink theme
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  cards: {
    gap: 16,
  },
  card: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f8f8f8',
    marginBottom: 16,
  },
  cardImage: {
    width: '100%',
    height: 120,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    padding: 8,
  },
  cardSub: {
    fontSize: 14,
    color: '#777',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
});
