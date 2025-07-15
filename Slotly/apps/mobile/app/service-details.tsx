// apps/mobile/app/service-details.tsx

import { View, Text, StyleSheet } from 'react-native';
import React from 'react';

const ServiceDetails = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Service Details</Text>
      <Text>This is where the selected service info will go.</Text>
    </View>
  );
};

export default ServiceDetails;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
  },
});
