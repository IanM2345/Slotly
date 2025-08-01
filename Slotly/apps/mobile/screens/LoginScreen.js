import React, { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { apiFetch } from '../lib/api'; 

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [user, setUser] = useState(null);

  const handleLogin = async () => {
    if ((!email && !phone) || !password) {
      alert('Please enter email/phone and password');
      return;
    }
    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, phone, password }),
      });
      setMessage(res.message);
      setUser(res.user); 
      
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
      <Text style={{ textAlign: 'center' }}>or</Text>
      <TextInput placeholder="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <TextInput placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      <Button title="Login" onPress={handleLogin} />
      {message ? <Text style={{ marginVertical: 10 }}>{message}</Text> : null}
      {/* Optionally render OTP input if user info is available */}
      {user && (
        <Button title="Enter OTP" onPress={() => navigation.navigate('OtpScreen', { userId: user.id })} />
      )}
      <Text onPress={() => navigation.navigate('Register')}>Don't have an account? Register</Text>
    </View>
  );
}
