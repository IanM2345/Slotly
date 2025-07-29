// apps/mobile/app/(tabs)/history.tsx

import React from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Text, Card, Title, Paragraph } from 'react-native-paper';

const mockHistory = [
  {
    id: '1',
    service: 'Haircut',
    date: 'July 12, 2025',
    time: '3:00 PM',
  },
  {
    id: '2',
    service: 'Massage',
    date: 'July 5, 2025',
    time: '1:30 PM',
  },
  {
    id: '3',
    service: 'Facial',
    date: 'June 28, 2025',
    time: '12:00 PM',
  },
];

export default function HistoryScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Booking History</Text>

      <FlatList
        data={mockHistory}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.service}>{item.service}</Title>
              <Paragraph>Date: {item.date}</Paragraph>
              <Paragraph>Time: {item.time}</Paragraph>
            </Card.Content>
          </Card>
        )}
        contentContainerStyle={{ paddingBottom: 16 }}
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
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  card: {
    marginBottom: 12,
    backgroundColor: '#fce4ec', // light pink background
    borderRadius: 10,
    elevation: 3,
  },
  service: {
    fontSize: 18,
    fontWeight: '600',
  },
});
