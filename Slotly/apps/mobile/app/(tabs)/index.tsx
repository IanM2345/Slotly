import React, { useState } from 'react';
import { View, ScrollView, Image, StyleSheet, TouchableOpacity } from 'react-native';
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

  const quickActions = [
    { id: 1, name: 'Beauty', icon: '💅', color: theme.colors.primary },
    { id: 2, name: 'Health', icon: '🏥', color: theme.colors.primary },
    { id: 3, name: 'Fitness', icon: '🏋', color: theme.colors.primary },
    { id: 4, name: 'Education', icon: '🎓', color: theme.colors.primary },
  ];

  const recentBookings = [
    {
      id: 1,
      service: 'Hair Styling',
      location: 'Beauty Salon, Westlands',
      date: 'May 15, 2:00 PM',
      status: 'Confirmed',
      statusColor: '#FACC15',
    }
  ];

  const nearYou = [
    { id: 1, name: 'Beauty Hub', distance: '0.5km away', icon: '💅' },
    { id: 2, name: 'City Clinic', distance: '1.2km away', icon: '🏥' },
    { id: 3, name: 'FitLife Gym', distance: '2.1km away', icon: '🏋' },
  ];

  return (
    <ScrollView 
      style={{ flex: 1, backgroundColor: theme.colors.background }} 
      contentContainerStyle={{ paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header with profile and notifications */}
      <View style={styles.header}>
        <Text variant="headlineMedium" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
          Slotly
        </Text>
        <View style={styles.headerRight}>
          <View style={[styles.notificationIcon, { backgroundColor: '#FACC15' }]}>
            <Text>🔔</Text>
          </View>
          <View style={[styles.profileIcon, { backgroundColor: theme.colors.primary }]}>
            <Text style={{ color: 'white', fontSize: 14, fontWeight: 'bold' }}>JD</Text>
          </View>
        </View>
      </View>

      <View style={{ height: 12 }} />
      
      <SearchBar 
        placeholder="Search services or locations" 
        value={query} 
        onChangeText={setQuery} 
        onPressFilters={() => router.push('/filters' as any)} 
      />

      {/* Hero Banner */}
      <UICard style={[styles.heroBanner, { backgroundColor: theme.colors.primary }]}>
        <View style={styles.heroContent}>
          <Text variant="headlineSmall" style={{ color: 'white', fontWeight: 'bold', textAlign: 'center' }}>
            Book Your Next
          </Text>
          <Text variant="headlineSmall" style={{ color: 'white', fontWeight: 'bold', textAlign: 'center' }}>
            Appointment Today!
          </Text>
        </View>
      </UICard>

      {/* Quick Actions */}
      <SectionHeader title="Quick Actions" />
      <View style={styles.quickActionsGrid}>
        {quickActions.map((action) => (
          <TouchableOpacity 
            key={action.id} 
            onPress={() => router.push('/(tabs)/explore' as any)}
            style={{ width: '48%' }}
          >
            <UICard style={[styles.quickActionCard, { borderColor: '#FACC15', borderWidth: 2 }]}>
              <Text style={{ fontSize: 24, marginBottom: 8 }}>{action.icon}</Text>
              <Text variant="titleSmall" style={{ color: theme.colors.primary, fontWeight: '600' }}>
                {action.name}
              </Text>
            </UICard>
          </TouchableOpacity>
        ))}
      </View>

      {/* Recent Bookings */}
      <SectionHeader 
        title="Recent Bookings" 
        actionLabel="View all" 
        onActionPress={() => router.push('/(tabs)/history' as any)} 
      />
      <View style={{ paddingHorizontal: 16 }}>
        {recentBookings.map((booking) => (
          <TouchableOpacity 
            key={booking.id}
            onPress={() => router.push('/(tabs)/history' as any)}
          >
            <UICard style={[styles.bookingCard, { borderColor: theme.colors.primary, borderWidth: 2 }]}>
              <View style={[styles.statusBadge, { backgroundColor: booking.statusColor }]}>
                <Text variant="bodySmall" style={{ color: theme.colors.primary, fontWeight: '600' }}>
                  {booking.status}
                </Text>
              </View>
              <Text variant="titleMedium" style={{ color: theme.colors.primary, fontWeight: '600', marginBottom: 5 }}>
                {booking.service}
              </Text>
              <Text variant="bodyMedium" style={{ color: '#666', marginBottom: 2 }}>
                📍 {booking.location}
              </Text>
              <Text variant="bodyMedium" style={{ color: '#666' }}>
                📅 {booking.date}
              </Text>
            </UICard>
          </TouchableOpacity>
        ))}
      </View>

      {/* Near You */}
      <SectionHeader 
        title="Near You" 
        actionLabel="View all" 
        onActionPress={() => router.push('/(tabs)/explore' as any)} 
      />
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        contentContainerStyle={styles.hScroll}
      >
        {nearYou.map((item) => (
          <TouchableOpacity 
            key={item.id}
            onPress={() => router.push('/(tabs)/explore' as any)}
          >
            <UICard style={[styles.nearYouCard, { backgroundColor: '#f0f7ff', borderColor: theme.colors.primary, borderWidth: 2 }]}>
              <View style={styles.nearYouContent}>
                <Text style={{ fontSize: 24, marginBottom: 8 }}>{item.icon}</Text>
                <Text variant="titleSmall" style={{ color: theme.colors.primary, fontWeight: '600', textAlign: 'center' }}>
                  {item.name}
                </Text>
                <Text variant="bodySmall" style={{ color: '#666', fontSize: 12, textAlign: 'center' }}>
                  {item.distance}
                </Text>
              </View>
            </UICard>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={{ height: 16 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notificationIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroBanner: {
    marginHorizontal: 16,
    marginVertical: 20,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
  },
  heroContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 20,
  },
  quickActionCard: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
  },
  bookingCard: {
    padding: 15,
    marginBottom: 15,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginBottom: 10,
  },
  hScroll: { 
    paddingHorizontal: 16, 
    paddingBottom: 8, 
    gap: 10 
  },
  nearYouCard: {
    width: 140,
    height: 120,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nearYouContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});