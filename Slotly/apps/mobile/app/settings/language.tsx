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

interface Language {
  id: string;
  name: string;
  nativeName?: string;
}

export default function LanguageScreen() {
  const theme = useTheme();
  const router = useRouter();
  
  const [selectedLanguage, setSelectedLanguage] = useState('automatic');

  const languages: Language[] = [
    { id: 'automatic', name: 'Automatic' },
    { id: 'en-gb', name: 'English (United Kingdom)' },
    { id: 'en-us', name: 'English (United States)' },
    { id: 'sw', name: 'Swahili' },
    { id: 'es', name: 'Español (Spanish)' },
    { id: 'fr', name: 'Français (French)' },
    { id: 'ar', name: 'Arabic' },
    { id: 'pt', name: 'Portuguese' },
  ];

  const handleBack = () => {
    router.back();
  };

  const handleLanguageSelect = (languageId: string) => {
    setSelectedLanguage(languageId);
    // Here you would typically save to AsyncStorage or your preferred storage
    console.log('Selected language:', languageId);
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
        <Text style={styles.headerTitle}>Language</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.languageContainer}>
          <RadioButton.Group
            onValueChange={handleLanguageSelect}
            value={selectedLanguage}
          >
            {languages.map((language) => (
              <TouchableRipple
                key={language.id}
                onPress={() => handleLanguageSelect(language.id)}
                style={styles.languageItem}
                rippleColor="rgba(0, 0, 0, 0.1)"
              >
                <View style={styles.languageContent}>
                  <RadioButton
                    value={language.id}
                    color="#ff69b4"
                    uncheckedColor="#666"
                  />
                  <Text style={[
                    styles.languageText,
                    selectedLanguage === language.id && styles.selectedText
                  ]}>
                    {language.name}
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
  languageContainer: {
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
  languageItem: {
    backgroundColor: 'transparent',
  },
  languageContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  languageText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 12,
    fontWeight: '500',
  },
  selectedText: {
    color: '#333',
    fontWeight: 'bold',
  },
  bottomSpacing: {
    height: 40,
  },
});
