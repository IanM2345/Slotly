import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';

// 🔁 Mock data for now
const mockBookings = [
  { id: '1', details: 'Conference Room - July 5', date: '2025-07-05' },
  { id: '2', details: 'Projector - July 10', date: '2025-07-10' },
  { id: '3', details: 'Meeting Hall - July 12', date: '2025-07-12' },
];

export default function BookingHistoryScreen() {
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    // 🔁 Simulate loading bookings from database
    setTimeout(() => {
      setBookings(mockBookings);
    }, 500);
  }, []);

  const renderItem = ({ item }) => (
    <View style={styles.item}>
      <Text style={styles.details}>{item.details}</Text>
      <Text style={styles.date}>{item.date}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Bookings</Text>
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#fff', flex: 1 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  item: {
    backgroundColor: '#f2f2f2',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
  },
  details: { fontSize: 16 },
  date: { color: 'gray', marginTop: 5 },
});

