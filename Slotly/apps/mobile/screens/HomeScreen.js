import React from 'react';
import { View, Text, Button } from 'react-native';
import { auth } from '../../firebase/config';

export default function HomeScreen({ navigation }) {
  const user = auth.currentUser;

  return (
    <View style={{ padding: 20 }}>
      <Text>Welcome, {user?.email}</Text>
      <Button title="Book Now" onPress={() => navigation.navigate('Booking')} />
      <Button title="Logout" onPress={() => auth.signOut().then(() => navigation.replace('Login'))} />
    <Button title="View Booking History" onPress={() => navigation.navigate('BookingHistory')} />
</View>
  );
}
 