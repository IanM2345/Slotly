import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../app/screens/LoginScreen';
import RegisterScreen from '../app/screens/RegisterScreen';
import HomeScreen from '../app/screens/HomeScreen';
import BookingScreen from '../app/screens/BookingScreen';
import BookingHistoryScreen from '../app/screens/BookingHistoryScreen';


const Stack = createNativeStackNavigator();

export default function StackNavigator() {
  return (
    <Stack.Navigator initialRouteName="Login">
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Booking" component={BookingScreen} />
      <Stack.Screen name="BookingHistory" component={BookingHistoryScreen} />

    </Stack.Navigator>
  );
}
