import React, { useState } from 'react';
import { View, Text, TextInput, Button, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function BookingScreen({ navigation }) {
  const [details, setDetails] = useState('');
  const [date, setDate] = useState(new Date());
  const [show, setShow] = useState(false);

  const onChange = (event, selectedDate) => {
    const currentDate = selectedDate || date;
    setShow(Platform.OS === 'ios'); // keep open on iOS
    setDate(currentDate);
  };

  const showDatepicker = () => {
    setShow(true);
  };

  const handleBooking = () => {
    alert(`Mock Booking for:\n${details}\n${date.toLocaleString()}`);
    navigation.goBack();
  };

  return (
    <View style={{ padding: 20 }}>
      <TextInput
        placeholder="Booking details"
        value={details}
        onChangeText={setDetails}
        style={{ marginBottom: 20 }}
      />

      <Button onPress={showDatepicker} title="Pick Date & Time" />

      {show && (
        <DateTimePicker
          value={date}
          mode="datetime"
          is24Hour={true}
          display="default"
          onChange={onChange}
        />
      )}

      <Text style={{ marginVertical: 10 }}>
        Selected: {date.toLocaleString()}
      </Text>

      <Button title="Confirm Booking" onPress={handleBooking} />
    </View>
  );
}
