// apps/mobile/app/service-details.tsx

import { View, Text, StyleSheet, ScrollView, Image, Button } from 'react-native';
import React from 'react';

const ServiceDetails = () => {
  return (
    <ScrollView style={styles.container}>
      <Image
        source={{ uri: 'https://via.placeholder.com/300x200.png?text=Service+Image' }}
        style={styles.banner}
      />
      <View style={styles.content}>
        <Text style={styles.title}>Luxury Haircut</Text>
        <Text style={styles.category}>Barber Service</Text>
        <Text style={styles.price}>KSh 1,500</Text>
        <Text style={styles.description}>
          Enjoy a premium grooming experience in our top-rated barber shop. Includes wash, trim, and optional styling consultation.
        </Text>
        <View style={styles.button}>
          <Button title="Book Now" color="#ff69b4" onPress={() => {}} />
        </View>
      </View>
    </ScrollView>
  );
};

export default ServiceDetails;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  banner: {
    width: '100%',
    height: 200,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  category: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  price: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ff69b4',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 22,
    color: '#444',
    marginBottom: 24,
  },
  button: {
    marginTop: 12,
  },
});
