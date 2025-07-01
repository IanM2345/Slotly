import React, { useState } from 'react';
import { View, TextInput, Button } from 'react-native';
import { addDoc, collection } from 'firebase/firestore';
import { db, auth } from '../../firebase/config';

export default function BookingScreen({ navigation }) {
  const [details, setDetails] = useState('');

  const handleBooking = async () => {
    try {
      await addDoc(collection(db, 'bookings'), {
        user: auth.currentUser.email,
        details,
        createdAt: new Date()
      });
      alert('Booking created!');
      navigation.goBack();
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <TextInput
        placeholder="Enter booking details"
        value={details}
        onChangeText={setDetails}
      />
      <Button title="Submit Booking" onPress={handleBooking} />
    </View>
  );
}
