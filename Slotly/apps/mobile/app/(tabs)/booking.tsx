// apps/mobile/app/(tabs)/booking.tsx

import React, { useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Text, Button, TextInput, useTheme, Menu } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function BookingScreen() {
  const theme = useTheme();

  const [selectedService, setSelectedService] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const services = ['Haircut', 'Massage', 'Facial', 'Makeup', 'Spa', 'Beard Trim'];
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);


  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) setDate(selectedDate);
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) setTime(selectedTime);
  };

  const handleConfirmBooking = () => {
    console.log('Booking Confirmed:', {
      service: selectedService,
      date: date.toDateString(),
      time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
    // In future: send booking to Firestore
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Book a Service</Text>

      <Menu
  visible={menuVisible}
  onDismiss={() => setMenuVisible(false)}
  anchor={
    <Button mode="outlined" onPress={() => setMenuVisible(true)} style={styles.input}>
      {selectedService || 'Choose a Service'}
    </Button>
  }
>
  {services.map((service, index) => (
    <Menu.Item
      key={index}
      onPress={() => {
        setSelectedService(service);
        setMenuVisible(false);
      }}
      title={service}
    />
  ))}
</Menu>


      <Button
        mode="outlined"
        onPress={() => setShowDatePicker(true)}
        style={styles.input}
      >
        {`Choose Date: ${date.toDateString()}`}
      </Button>

      <Button
        mode="outlined"
        onPress={() => setShowTimePicker(true)}
        style={styles.input}
      >
        {`Choose Time: ${time.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}`}
      </Button>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
        />
      )}

      {/* Time Picker Modal */}
      {showTimePicker && (
        <DateTimePicker
          value={time}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleTimeChange}
        />
      )}
      {bookingConfirmed && (
  <View style={styles.confirmation}>
    <Text style={{ color: 'green', fontSize: 16 }}>
      ✅ Booking Confirmed for {selectedService} on {date.toDateString()} at{' '}
      {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </Text>
  </View>
)}


      <Button
  mode="contained"
  onPress={() => {
    if (!selectedService) {
      alert("Please enter a service name.");
      return;
    }

    setBookingConfirmed(true);
  }}
  style={styles.button}
>
  Confirm Booking
</Button>

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
    marginBottom: 24,
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 24,
    backgroundColor: '#6a42d9',
  },
  confirmation: {
  backgroundColor: '#e0ffe0',
  padding: 12,
  borderRadius: 8,
  marginBottom: 16,
}

});
