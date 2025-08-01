import React, { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { apiFetch } from '../lib/api'; 

export default function RegisterScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleRegister = async () => {
    if (!email && !phone) {
      alert('Please enter an email or phone.');
      return;
    }
    if (!name || !password) {
      alert('Please enter name and password.');
      return;
    }

    try {
      const res = await apiFetch('/auth/signup/initiate', {
        method: 'POST',
        body: JSON.stringify({ email, phone, name, password }),
      });

      setMessage(res.message || 'Check your email or phone for the OTP.');
    
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <TextInput placeholder="Name" value={name} onChangeText={setName} />
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} />
      <TextInput placeholder="Phone" value={phone} onChangeText={setPhone} />
      <TextInput placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      <Button title="Register" onPress={handleRegister} />
      {message ? <Text>{message}</Text> : null}
    </View>
  );
}
