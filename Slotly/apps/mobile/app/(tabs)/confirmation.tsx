// apps/mobile/app/(tabs)/confirmation.tsx

import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';

export default function BookingConfirmationScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: 'https://cdn-icons-png.flaticon.com/512/845/845646.png' }}
        style={styles.image}
      />
      <Text style={styles.title}>Booking Confirmed!</Text>
      <Text style={styles.subtitle}>Your appointment has been scheduled successfully.</Text>

      {/* Summary */}
      <View style={styles.summaryBox}>
        <Text style={styles.summaryLabel}>Service:</Text>
        <Text style={styles.summaryText}>Haircut</Text>

        <Text style={styles.summaryLabel}>Date:</Text>
        <Text style={styles.summaryText}>July 20, 2025</Text>

        <Text style={styles.summaryLabel}>Time:</Text>
        <Text style={styles.summaryText}>2:00 PM</Text>
      </View>

      <Button
        mode="contained"
        style={styles.button}
        onPress={() => router.push('/history')}
      >
        View My Bookings
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  image: {
    width: 100,
    height: 100,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#d63384', // pink
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
    color: '#555',
  },
  summaryBox: {
    width: '100%',
    backgroundColor: '#ffe6ef',
    padding: 16,
    borderRadius: 10,
    marginBottom: 24,
  },
  summaryLabel: {
    fontWeight: 'bold',
    fontSize: 14,
    marginTop: 8,
    color: '#555',
  },
  summaryText: {
    fontSize: 16,
    color: '#000',
  },
  button: {
    width: '100%',
    paddingVertical: 6,
    backgroundColor: '#d63384',
  },
});
