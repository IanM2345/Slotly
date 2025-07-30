import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Image } from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Divider,
  Surface
} from 'react-native-paper';
import { useRouter } from 'expo-router';

export default function AuthScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleContinue = () => {
    router.push('/home');
  };

  const handleSignIn = () => {
    router.push('/login');
  };

  const handleForgotPassword = () => {
    router.push('/forgot-password');
  };

  return (
    <Surface style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Country Header */}
        <View style={styles.header}>
          <View style={styles.countrySelector}>
            <Image source={require('../../../assets/images/kenya.png')} style={styles.flagImage} />
            <Text style={styles.countryText}>Kenya</Text>
            <Text style={styles.dropdownIcon}>▼</Text>
          </View>
        </View>

        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.mainTitle}>Get Started</Text>
          <Text style={styles.subtitle}>Create an account or log in</Text>
        </View>

        {/* Form */}
        <TextInput
          mode="outlined"
          label="Email address"
          value={email}
          onChangeText={setEmail}
          style={styles.textInput}
          outlineColor="#333"
          activeOutlineColor="#333"
          textColor="#333"
          keyboardType="email-address"
        />
        <TextInput
          mode="outlined"
          label="Password"
          value={password}
          onChangeText={setPassword}
          style={styles.textInput}
          outlineColor="#333"
          activeOutlineColor="#333"
          textColor="#333"
          secureTextEntry
        />
        <TouchableOpacity onPress={handleForgotPassword}>
          <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.dividerSection}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Social Logins */}
        <Button
          mode="outlined"
          onPress={() => console.log('Apple login')}
          style={styles.socialButton}
        >
          <Image source={require('../../../assets/images/Apple.png')} style={styles.icon} />
          <Text style={styles.socialText}>Continue with Apple</Text>
        </Button>
        <Button
          mode="outlined"
          onPress={() => console.log('Google login')}
          style={styles.socialButton}
        >
          <Image source={require('../../../assets/images/logo-google.png')} style={styles.icon} />
          <Text style={styles.socialText}>Continue with Google</Text>
        </Button>
        <Button
          mode="outlined"
          onPress={() => console.log('Facebook login')}
          style={styles.socialButton}
        >
          <Image source={require('../../../assets/images/Facebook.png')} style={styles.icon} />
          <Text style={styles.socialText}>Continue with Facebook</Text>
        </Button>

        {/* Sign In link */}
        <TouchableOpacity onPress={handleSignIn}>
          <Text style={styles.signInText}>
            Already have an account? <Text style={styles.signInLink}>Sign in...</Text>
          </Text>
        </TouchableOpacity>

        {/* Continue */}
        <Button
          mode="contained"
          onPress={handleContinue}
          style={styles.continueButton}
          labelStyle={styles.continueButtonText}
        >
          Continue
        </Button>
      </ScrollView>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffc0cb',
  },
  scrollContent: {
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  flagImage: {
    width: 24,
    height: 16,
    marginRight: 8,
  },
  countryText: {
    fontSize: 16,
    color: '#333',
    marginRight: 4,
  },
  dropdownIcon: {
    fontSize: 12,
    color: '#333',
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  mainTitle: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 18,
    color: '#333',
  },
  textInput: {
    marginBottom: 16,
    backgroundColor: 'rgba(255, 192, 203, 0.7)',
  },
  forgotPasswordText: {
    color: '#333',
    textDecorationLine: 'underline',
    marginBottom: 24,
  },
  dividerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#333',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#333',
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 6,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  icon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  socialText: {
    color: '#333',
    fontWeight: '500',
  },
  signInText: {
    textAlign: 'center',
    marginVertical: 24,
    color: '#333',
  },
  signInLink: {
    textDecorationLine: 'underline',
    fontWeight: 'bold',
  },
  continueButton: {
    backgroundColor: '#ff69b4',
    borderRadius: 6,
    marginTop: 12,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});
