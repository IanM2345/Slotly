import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import {
  Text,
  Searchbar,
  Surface,
  Card,
  Button,
  IconButton,
  Chip,
  useTheme
} from 'react-native-paper';
import { useRouter } from 'expo-router';

interface Service {
  id: string;
  name: string;
  provider: string;
  price: number;
  image: string;
  rating: number;
  category: string;
  location: string;
}

interface Category {
  id: string;
  name: string;
  active: boolean;
}

export default function ExploreServicesScreen() {
  const theme = useTheme();
  const router = useRouter();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<Category[]>([
    { id: '1', name: 'All', active: true },
    { id: '2', name: 'Hair', active: false },
    { id: '3', name: 'Nails', active: false },
    { id: '4', name: 'Spa', active: false },
    { id: '5', name: 'Barber', active: false },
    { id: '6', name: 'Massage', active: false },
  ]);

  // Mock data for services
  const services: Service[] = [
    {
      id: '1',
      name: 'Hair Styling & Cut',
      provider: 'Bella Beauty Salon',
      price: 2500,
      image: 'https://via.placeholder.com/200x150.png?text=Hair+Styling',
      rating: 4.8,
      category: 'Hair',
      location: 'Westlands'
    },
    {
      id: '2',
      name: 'Classic Beard Trim',
      provider: 'Gents Barber Shop',
      price: 800,
      image: 'https://via.placeholder.com/200x150.png?text=Beard+Trim',
      rating: 4.6,
      category: 'Barber',
      location: 'CBD'
    },
    {
      id: '3',
      name: 'Gel Manicure',
      provider: 'Nail Studio Pro',
      price: 1500,
      image: 'https://via.placeholder.com/200x150.png?text=Manicure',
      rating: 4.9,
      category: 'Nails',
      location: 'Karen'
    },
    {
      id: '4',
      name: 'Full Body Massage',
      provider: 'Spa Relax Center',
      price: 4000,
      image: 'https://via.placeholder.com/200x150.png?text=Massage',
      rating: 4.7,
      category: 'Massage',
      location: 'Kilimani'
    },
    {
      id: '5',
      name: 'Facial Treatment',
      provider: 'Beauty Haven',
      price: 3000,
      image: 'https://via.placeholder.com/200x150.png?text=Facial',
      rating: 4.5,
      category: 'Spa',
      location: 'Westlands'
    },
    {
      id: '6',
      name: 'Bridal Makeup',
      provider: 'Glam Studio',
      price: 8000,
      image: 'https://via.placeholder.com/200x150.png?text=Makeup',
      rating: 4.9,
      category: 'Makeup',
      location: 'Karen'
    }
  ];

  const popularServices = services.slice(0, 4);
  const allServices = services;

  const handleServicePress = (service: Service) => {
   router.push({
  pathname: '/service/[id]' as const,
  params: { id: service.id },
});
  };

  const handleCategoryPress = (categoryId: string) => {
    setCategories(prev => 
      prev.map(cat => ({
        ...cat,
        active: cat.id === categoryId
      }))
    );
  };

  const handleLocationPress = () => {
    router.push('/location-selector');
  };

  const handleDatePress = () => {
    router.push('/date-selector');
  };

  const handleFilterPress = () => {
    router.push('/filters');
  };

  const renderServiceCard = ({ item }: { item: Service }) => (
    <TouchableOpacity 
      style={styles.serviceCard}
      onPress={() => handleServicePress(item)}
    >
      <Card style={styles.card} mode="elevated">
        <Card.Cover 
          source={{ uri: item.image }} 
          style={styles.serviceImage}
        />
        <Card.Content style={styles.serviceContent}>
          <Text style={styles.serviceName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.serviceProvider} numberOfLines={1}>{item.provider}</Text>
          <Text style={styles.serviceLocation}>📍 {item.location}</Text>
          <View style={styles.serviceFooter}>
            <Text style={styles.servicePrice}>KSh {item.price.toLocaleString()}</Text>
            <Text style={styles.serviceRating}>⭐ {item.rating}</Text>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  const renderCategoryChip = ({ item }: { item: Category }) => (
    <Chip
      selected={item.active}
      onPress={() => handleCategoryPress(item.id)}
      style={[
        styles.categoryChip,
        item.active && styles.activeCategoryChip
      ]}
      textStyle={[
        styles.categoryChipText,
        item.active && styles.activeCategoryChipText
      ]}
    >
      {item.name}
    </Chip>
  );

  return (
    <Surface style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header Controls */}
        <View style={styles.header}>
          {/* View Toggle */}
          <View style={styles.viewToggle}>
            <Button
  mode="outlined"
  onPress={() => router.push('/explore')} // points to index.tsx
  style={styles.toggleButton}
  labelStyle={styles.toggleButtonText}
>
  Institutions
</Button>
            <Button
              mode="contained"
              style={[styles.toggleButton, styles.activeToggle]}
              labelStyle={styles.toggleButtonText}
            >
              Services
            </Button>
          </View>

          {/* Search and Filter Row */}
          <View style={styles.searchRow}>
            <Searchbar
              placeholder="Search services..."
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={styles.searchBar}
              inputStyle={styles.searchInput}
              iconColor="#333"
            />
            <IconButton
              icon="tune"
              size={24}
              iconColor="#333"
              style={styles.filterButton}
              onPress={handleFilterPress}
            />
          </View>

          {/* Location and Date Row */}
          <View style={styles.controlsRow}>
            <TouchableOpacity style={styles.locationButton} onPress={handleLocationPress}>
              <Text style={styles.locationIcon}>📍</Text>
              <Text style={styles.locationText}>Nairobi, Kenya</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.dateButton} onPress={handleDatePress}>
              <Text style={styles.dateIcon}>📅</Text>
              <Text style={styles.dateText}>when?</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Category Filter */}
        <View style={styles.categorySection}>
          <FlatList
            data={categories}
            renderItem={renderCategoryChip}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryContainer}
          />
        </View>

        {/* Featured Services */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>service name</Text>
          </View>
          <FlatList
            data={popularServices.slice(0, 2)}
            renderItem={renderServiceCard}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.servicesContainer}
          />
        </View>

        {/* Popular Services */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>popular in your area: results(5)</Text>
          </View>
          <FlatList
            data={allServices}
            renderItem={renderServiceCard}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.serviceRow}
            contentContainerStyle={styles.gridContainer}
          />
        </View>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ff1493', // Bright pink background
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  viewToggle: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  toggleButton: {
    flex: 1,
    borderColor: '#333',
    borderRadius: 25,
  },
  activeToggle: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  toggleButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  searchBar: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 25,
  },
  searchInput: {
    color: '#333',
  },
  filterButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#333',
  },
  locationIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  locationText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#333',
  },
  dateIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  dateText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  categorySection: {
    marginBottom: 16,
  },
  categoryContainer: {
    paddingHorizontal: 16,
  },
  categoryChip: {
    marginRight: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderColor: '#333',
  },
  activeCategoryChip: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  categoryChipText: {
    color: '#333',
  },
  activeCategoryChipText: {
    color: '#333',
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  servicesContainer: {
    paddingHorizontal: 16,
  },
  gridContainer: {
    paddingHorizontal: 16,
  },
  serviceRow: {
    justifyContent: 'space-between',
  },
  serviceCard: {
    width: '48%',
    marginBottom: 16,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  serviceImage: {
    height: 120,
  },
  serviceContent: {
    padding: 12,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  serviceProvider: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  serviceLocation: {
    fontSize: 12,
    color: '#333',
    marginBottom: 8,
  },
  serviceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  servicePrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  serviceRating: {
    fontSize: 14,
    color: '#333',
  },
  bottomSpacing: {
    height: 100,
  },
});