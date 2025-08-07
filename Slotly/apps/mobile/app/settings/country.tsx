import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import {
  Text,
  Surface,
  IconButton,
  RadioButton,
  TouchableRipple,
  useTheme
} from 'react-native-paper';
import { useRouter } from 'expo-router';

interface Country {
  id: string;
  name: string;
  enabled: boolean;
}

export default function CountryScreen() {
  const theme = useTheme();
  const router = useRouter();
  
  const [selectedCountry, setSelectedCountry] = useState('kenya');

  const countries: Country[] = [
    { id: 'kenya', name: 'Kenya', enabled: true },
    { id: 'uganda', name: 'Uganda', enabled: false },
    { id: 'tanzania', name: 'Tanzania', enabled: false },
    { id: 'rwanda', name: 'Rwanda', enabled: false },
    { id: 'burundi', name: 'Burundi', enabled: false },
    { id: 'south-sudan', name: 'South Sudan', enabled: false },
    { id: 'ethiopia', name: 'Ethiopia', enabled: false },
  ];

  const handleBack = () => {
    router.back();
  };

  const handleCountrySelect = (countryId: string) => {
    const country = countries.find(c => c.id === countryId);
    if (country && country.enabled) {
      setSelectedCountry(countryId);
    }
  };

  return (
    <Surface style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          iconColor="#333"
          onPress={handleBack}
          style={styles.backButton}
        />
        <Text style={styles.headerTitle}>Countries</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.radioContainer}>
          <RadioButton.Group
            onValueChange={handleCountrySelect}
            value={selectedCountry}
          >
            {countries.map((country) => (
              <TouchableRipple
                key={country.id}
                onPress={() => handleCountrySelect(country.id)}
                style={[
                  styles.radioItem,
                  !country.enabled && styles.disabledItem
                ]}
                rippleColor={country.enabled ? "rgba(0, 0, 0, 0.1)" : "transparent"}
                disabled={!country.enabled}
              >
                <View style={styles.radioContent}>
                  <RadioButton
                    value={country.id}
                    color="#ff69b4"
                    uncheckedColor={country.enabled ? "#666" : "#ccc"}
                    disabled={!country.enabled}
                  />
                  <Text style={[
                    styles.countryText,
                    selectedCountry === country.id && country.enabled && styles.selectedText,
                    !country.enabled && styles.disabledText
                  ]}>
                    {country.name}
                  </Text>
                </View>
              </TouchableRipple>
            ))}
          </RadioButton.Group>
        </View>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffc0cb', // Slotly pink background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 16,
    paddingBottom: 16,
  },
  backButton: {
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
    marginRight: 48, // Compensate for back button width
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  radioContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    marginTop: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  radioItem: {
    backgroundColor: 'transparent',
  },
  disabledItem: {
    opacity: 0.5,
  },
  radioContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  countryText: {
    fontSize: 18,
    color: '#666',
    marginLeft: 12,
    fontWeight: '500',
  },
  selectedText: {
    color: '#333',
    fontWeight: 'bold',
  },
  disabledText: {
    color: '#ccc',
  },
  bottomSpacing: {
    height: 40,
  },
});
