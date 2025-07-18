import React from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Text, Card, useTheme } from 'react-native-paper';

const mockBookings = [
  {
    id: '1',
    service: 'Haircut',
    date: '2025-07-15',
    time: '10:00 AM',
    provider: 'John’s Barber',
  },
  {
    id: '2',
    service: 'Massage',
    date: '2025-07-10',
    time: '3:00 PM',
    provider: 'Relax Spa',
  },
  {
    id: '3',
    service: 'Nail Treatment',
    date: '2025-07-01',
    time: '1:30 PM',
    provider: 'Nail Studio',
  },
];

export default function HistoryScreen() {
  const theme = useTheme();

  const renderItem = ({ item }: any) => (
    <Card style={styles.card}>
      <Card.Title title={item.service} subtitle={`${item.date} at ${item.time}`} />
      <Card.Content>
        <Text>{item.provider}</Text>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Booking History</Text>
      <FlatList
        data={mockBookings}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  heading: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  card: {
    marginBottom: 12,
  },
});

