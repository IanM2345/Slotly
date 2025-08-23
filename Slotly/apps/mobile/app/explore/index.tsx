import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, FlatList, Image } from 'react-native';
import {
  Text,
  Searchbar,
  Surface,
  Card,
  Button,
  IconButton,
  useTheme
} from 'react-native-paper';
import { useRouter } from 'expo-router';

interface Institution {
  id: string;
  name: string;
  tagline: string;
  location: string;
  image: string;
  rating: number;
}

interface ServiceCategory {
  id: string;
  name: string;
  icon: string;
}

export default function ExploreScreen() {
  const theme = useTheme();
  const router = useRouter();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedView, setSelectedView] = useState<'institutions' | 'services'>('institutions');

  // Mock data for institutions
  const popularInstitutions: Institution[] = [
    {
      id: '1',
      name: 'Bella Beauty Salon',
      tagline: 'Premium hair & beauty services',
      location: 'Westlands, Nairobi',
      image: 'https://via.placeholder.com/300x200.png?text=Bella+Beauty',
      rating: 4.8
    },
    {
      id: '2',
      name: 'Gents Barber Shop',
      tagline: 'Traditional & modern cuts',
      location: 'CBD, Nairobi',
      image: 'https://via.placeholder.com/300x200.png?text=Gents+Barber',
      rating: 4.6
    },
    {
      id: '3',
      name: 'Spa Relax Center',
      tagline: 'Wellness & relaxation',
      location: 'Karen, Nairobi',
      image: 'https://via.placeholder.com/300x200.png?text=Spa+Relax',
      rating: 4.9
    }
  ];

  const governmentOffices: Institution[] = [
    {
      id: '4',
      name: 'Huduma Centre Westlands',
      tagline: 'Government services hub',
      location: 'Westlands, Nairobi',
      image: 'https://via.placeholder.com/300x200.png?text=Huduma+Centre',
      rating: 4.2
    },
    {
      id: '5',
      name: 'Immigration Office',
      tagline: 'Passport & visa services',
      location: 'Upper Hill, Nairobi',
      image: 'https://via.placeholder.com/300x200.png?text=Immigration',
      rating: 3.8
    }
  ];

  const serviceCategories: ServiceCategory[] = [
    { id: '1', name: 'Hair', icon: '✂️' },
    { id: '2', name: 'Nails', icon: '💅' },
    { id: '3', name: 'Spa', icon: '🧖‍♀️' },
    { id: '4', name: 'Barber', icon: '💇‍♂️' },
    { id: '5', name: 'Massage', icon: '💆‍♀️' },
    { id: '6', name: 'Makeup', icon: '💄' }
  ];

  const handleInstitutionPress = (institution: Institution) => {
    router.push(`/institution/${institution.id}`);
  };

  const handleViewAllPress = (section: string) => {
    router.push(`/institution/${section}` as any);
  };

  const handleCategoryPress = (category: ServiceCategory) => {
    router.push(`/category/${category.id}`);
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

  const renderInstitutionCard = ({ item }: { item: Institution }) => (
    <TouchableOpacity onPress={() => handleInstitutionPress(item)}>
      <Card style={styles.institutionCard} mode="elevated">
        <Card.Cover 
          source={{ uri: item.image }} 
          style={styles.cardImage}
        />
        <Card.Content style={styles.cardContent}>
          <Text style={styles.institutionName}>{item.name}</Text>
          <Text style={styles.institutionTagline}>{item.tagline}</Text>
          <Text style={styles.institutionLocation}>📍 {item.location}</Text>
          <View style={styles.ratingContainer}>
            <Text style={styles.rating}>⭐ {item.rating}</Text>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  const renderCategoryItem = ({ item }: { item: ServiceCategory }) => (
    <TouchableOpacity 
      style={styles.categoryItem}
      onPress={() => handleCategoryPress(item)}
    >
      <Surface style={styles.categoryIcon} elevation={2}>
        <Text style={styles.categoryEmoji}>{item.icon}</Text>
      </Surface>
      <Text style={styles.categoryName}>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <Surface style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header Controls */}
        <View style={styles.header}>
          {/* View Toggle */}
          <View style={styles.viewToggle}>
            <Button
              mode={selectedView === 'institutions' ? 'contained' : 'outlined'}
              onPress={() => setSelectedView('institutions')}
              style={[
                styles.toggleButton,
                selectedView === 'institutions' && styles.activeToggle
              ]}
              labelStyle={styles.toggleButtonText}
            >
              Institutions
            </Button>
            <Button
              mode={selectedView === 'services' ? 'contained' : 'outlined'}
              onPress={() => router.push('/explore' as any)}
              style={styles.toggleButton}
              labelStyle={styles.toggleButtonText}
            >
              Services
            </Button>
          </View>

          {/* Search and Filter Row */}
          <View style={styles.searchRow}>
            <Searchbar
              placeholder="Search institutions..."
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

        {/* Service Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <FlatList
            data={serviceCategories}
            renderItem={renderCategoryItem}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesContainer}
          />
        </View>

        {/* Popular Institutions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Popular Institutions</Text>
            <TouchableOpacity onPress={() => handleViewAllPress('popular')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={popularInstitutions}
            renderItem={renderInstitutionCard}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cardsContainer}
          />
        </View>

        {/* Government Offices */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Government offices in your area</Text>
            <TouchableOpacity onPress={() => handleViewAllPress('government')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={governmentOffices}
            renderItem={renderInstitutionCard}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cardsContainer}
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
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  viewAllText: {
    fontSize: 16,
    color: '#333',
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  categoriesContainer: {
    paddingHorizontal: 16,
  },
  categoryItem: {
    alignItems: 'center',
    marginRight: 16,
    width: 80,
  },
  categoryIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryEmoji: {
    fontSize: 24,
  },
  categoryName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    textAlign: 'center',
  },
  cardsContainer: {
    paddingHorizontal: 16,
  },
  institutionCard: {
    width: 280,
    marginRight: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  cardImage: {
    height: 160,
  },
  cardContent: {
    padding: 12,
  },
  institutionName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  institutionTagline: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  institutionLocation: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  ratingContainer: {
    alignItems: 'flex-start',
  },
  rating: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 100,
  },
});