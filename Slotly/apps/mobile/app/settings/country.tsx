import React, { useEffect, useState } from 'react';
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
import { getCountry, setCountry } from '../../lib/settings/api';

interface Country {
  id: string;
  name: string;
  enabled: boolean;
}

export default function CountryScreen() {
  const theme = useTheme();
  const router = useRouter();
  
  const [selectedCountry, setSelectedCountry] = useState('Kenya');

  const countries: Country[] = [
    { id: 'Kenya', name: 'Kenya', enabled: true },
    { id: 'Uganda', name: 'Uganda', enabled: true },
    { id: 'Tanzania', name: 'Tanzania', enabled: true },
    { id: 'Rwanda', name: 'Rwanda', enabled: true },
    { id: 'Burundi', name: 'Burundi', enabled: true },
    { id: 'South Sudan', name: 'South Sudan', enabled: true },
    { id: 'Ethiopia', name: 'Ethiopia', enabled: true },
  ];

  const handleBack = () => {
    router.back();
  };

  useEffect(() => {
    getCountry().then((c) => setSelectedCountry(c || 'Kenya')).catch(() => {});
  }, []);

  const handleCountrySelect = async (countryId: string) => {
    const country = countries.find(c => c.id === countryId);
    if (country && country.enabled) {
      setSelectedCountry(countryId);
      try { await setCountry(countryId); } catch {}
    }
  };

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton icon="arrow-left" size={24} iconColor={theme.colors.onSurface} onPress={handleBack} style={styles.backButton} />
        <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>Countries</Text>
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
  container: { flex: 1 },
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
  headerTitle: { fontSize: 28, fontWeight: 'bold', flex: 1, textAlign: 'center', marginRight: 48 },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  radioContainer: { borderRadius: 12, marginTop: 20, overflow: 'hidden' },
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
  countryText: { fontSize: 18, marginLeft: 12, fontWeight: '500' },
  selectedText: { fontWeight: 'bold' },
  disabledText: { opacity: 0.5 },
  bottomSpacing: {
    height: 40,
  },
});
