import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { 
  Text, 
  Avatar, 
  Button, 
  Card, 
  Divider, 
  IconButton,
  useTheme,
  Surface
} from 'react-native-paper';
import { useRouter } from 'expo-router';

interface UserData {
  name: string;
  email: string;
  phone: string;
  profileImage?: string;
  joinDate: string;
  totalBookings: number;
}

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  
  // Mock user data - replace with actual user data from your state management
  const [userData] = useState<UserData>({
    name: 'John Doe',
    email: 'john.doe@email.com',
    phone: '+254 712 345 678',
    profileImage: 'https://via.placeholder.com/150x150.png?text=JD',
    joinDate: 'January 2024',
    totalBookings: 12
  });

  const favoriteServices = [
    { id: 1, name: 'Hair Cut', image: 'https://via.placeholder.com/60x60.png?text=Hair' },
    { id: 2, name: 'Manicure', image: 'https://via.placeholder.com/60x60.png?text=Nails' },
    { id: 3, name: 'Massage', image: 'https://via.placeholder.com/60x60.png?text=Spa' },
    { id: 4, name: 'Barber', image: 'https://via.placeholder.com/60x60.png?text=Cut' },
    { id: 5, name: 'Facial', image: 'https://via.placeholder.com/60x60.png?text=Face' },
    { id: 6, name: 'Makeup', image: 'https://via.placeholder.com/60x60.png?text=MU' },
  ];

  const frequentlyVisited = [
    { id: 1, name: 'Bella Salon', image: 'https://via.placeholder.com/60x60.png?text=BS' },
    { id: 2, name: 'Gents Barber', image: 'https://via.placeholder.com/60x60.png?text=GB' },
    { id: 3, name: 'Spa Relax', image: 'https://via.placeholder.com/60x60.png?text=SR' },
    { id: 4, name: 'Nail Studio', image: 'https://via.placeholder.com/60x60.png?text=NS' },
    { id: 5, name: 'Hair Plus', image: 'https://via.placeholder.com/60x60.png?text=HP' },
    { id: 6, name: 'Beauty Hub', image: 'https://via.placeholder.com/60x60.png?text=BH' },
  ];

  const handleEditProfile = () => {
    // Navigate to edit profile screen
    router.push('/edit-profile' as any);
  };

  const handleSettings = () => {
    // Navigate to settings screen
    router.push('/settings' as any);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header with Settings */}
      <View style={styles.header}>
        <IconButton
          icon="cog"
          size={28}
          iconColor="#666"
          onPress={handleSettings}
          style={styles.settingsButton}
        />
      </View>

      {/* Profile Section */}
      <Surface style={styles.profileSection} elevation={2}>
        <View style={styles.profileHeader}>
          <Avatar.Image
            size={80}
            source={{ uri: userData.profileImage }}
            style={styles.avatar}
          />
          <View style={styles.profileInfo}>
            <Text style={styles.greeting}>hello,</Text>
            <Text style={styles.userName}>{userData.name}</Text>
            <Text style={styles.memberSince}>Member since {userData.joinDate}</Text>
          </View>
        </View>

        {/* User Details Card */}
        <Card style={styles.detailsCard} mode="outlined">
          <Card.Content>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Email</Text>
              <Text style={styles.detailValue}>{userData.email}</Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Phone</Text>
              <Text style={styles.detailValue}>{userData.phone}</Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Total Bookings</Text>
              <Text style={styles.detailValue}>{userData.totalBookings}</Text>
            </View>
          </Card.Content>
        </Card>
      </Surface>

      {/* Favorites Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Favourites:</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.horizontalScroll}
          contentContainerStyle={styles.scrollContent}
        >
          {favoriteServices.map((service) => (
            <TouchableOpacity key={service.id} style={styles.serviceItem}>
              <Avatar.Image
                size={60}
                source={{ uri: service.image }}
                style={styles.serviceAvatar}
              />
              <Text style={styles.serviceName}>{service.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Frequently Visited Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Frequently visited:</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.horizontalScroll}
          contentContainerStyle={styles.scrollContent}
        >
          {frequentlyVisited.map((place) => (
            <TouchableOpacity key={place.id} style={styles.serviceItem}>
              <Avatar.Image
                size={60}
                source={{ uri: place.image }}
                style={styles.serviceAvatar}
              />
              <Text style={styles.serviceName}>{place.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Button
          mode="outlined"
          onPress={() => router.push('/booking-history' as any)}
          style={[styles.actionButton, styles.outlinedButton]}
          labelStyle={styles.outlinedButtonText}
        >
          Booking History
        </Button>
        <Button
          mode="outlined"
          onPress={() => router.push('/favorites' as any)}
          style={[styles.actionButton, styles.outlinedButton]}
          labelStyle={styles.outlinedButtonText}
        >
          My Favorites
        </Button>
      </View>

      {/* Edit Profile Button */}
      <View style={styles.editButtonContainer}>
        <Button
          mode="contained"
          onPress={handleEditProfile}
          style={styles.editButton}
          labelStyle={styles.editButtonText}
          contentStyle={styles.editButtonContent}
        >
          Edit Profile
        </Button>
      </View>

      {/* Bottom Spacing */}
      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffc0cb', // Light pink background
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  settingsButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  profileSection: {
    margin: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 20,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    marginRight: 16,
    backgroundColor: '#fff',
  },
  profileInfo: {
    flex: 1,
  },
  greeting: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  memberSince: {
    fontSize: 14,
    color: '#888',
  },
  detailsCard: {
    backgroundColor: '#fff',
    borderColor: '#f0f0f0',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  detailLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  divider: {
    backgroundColor: '#f0f0f0',
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  horizontalScroll: {
    marginHorizontal: -8,
  },
  scrollContent: {
    paddingHorizontal: 8,
  },
  serviceItem: {
    alignItems: 'center',
    marginHorizontal: 8,
    width: 80,
  },
  serviceAvatar: {
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  serviceName: {
    fontSize: 12,
    textAlign: 'center',
    color: '#333',
    fontWeight: '500',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 24,
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
  outlinedButton: {
    borderColor: '#fff',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  outlinedButtonText: {
    color: '#333',
    fontWeight: '600',
  },
  editButtonContainer: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  editButton: {
    backgroundColor: '#ff69b4', // Darker pink for the main button
    borderRadius: 25,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  editButtonContent: {
    paddingVertical: 8,
  },
  bottomSpacing: {
    height: 100, // Extra space for bottom navigation
  },
});