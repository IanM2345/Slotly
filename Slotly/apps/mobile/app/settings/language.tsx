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
import { getLanguage, setLanguage } from '../../lib/settings/api';

interface Language {
  id: string;
  name: string;
  nativeName?: string;
}

export default function LanguageScreen() {
  const theme = useTheme();
  const router = useRouter();
  
  const [selectedLanguage, setSelectedLanguage] = useState('auto');

  const languages: Language[] = [
    { id: 'auto', name: 'Automatic' },
    { id: 'en-UK', name: 'English (United Kingdom)' },
    { id: 'en-US', name: 'English (United States)' },
    { id: 'sw', name: 'Swahili' },
    { id: 'es', name: 'Español (Spanish)' },
    { id: 'fr', name: 'Français (French)' },
    { id: 'ar', name: 'Arabic' },
    { id: 'pt', name: 'Portuguese' },
  ];

  const handleBack = () => {
    router.back();
  };

  useEffect(() => {
    getLanguage().then((lang) => setSelectedLanguage(lang || 'auto')).catch(() => {});
  }, []);

  const handleLanguageSelect = async (languageId: string) => {
    setSelectedLanguage(languageId);
    try { await setLanguage(languageId as any); } catch {}
  };

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton icon="arrow-left" size={24} iconColor={theme.colors.onSurface} onPress={handleBack} style={styles.backButton} />
        <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>Language</Text>
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
  languageContainer: { borderRadius: 12, marginTop: 20, overflow: 'hidden' },
  languageItem: {
    backgroundColor: 'transparent',
  },
  languageContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  languageText: { fontSize: 16, marginLeft: 12, fontWeight: '500' },
  selectedText: { fontWeight: 'bold' },
  bottomSpacing: {
    height: 40,
  },
});
