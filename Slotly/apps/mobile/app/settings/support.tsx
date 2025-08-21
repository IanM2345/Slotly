import React from 'react';
import { View, ScrollView, StyleSheet, Linking } from 'react-native';
import {
  Text,
  Surface,
  IconButton,
  Button,
  TouchableRipple,
  useTheme
} from 'react-native-paper';
import { useRouter } from 'expo-router';

export default function SupportScreen() {
  const theme = useTheme();
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  const handleFAQs = () => { router.push('/settings/FAQs' as any); };

  const handleRateUs = () => { router.push('/settings/feedback' as any); };

  const openMail = () => Linking.openURL('mailto:support@slotly.app');
  const openTel = () => Linking.openURL('tel:+254700000000');
  const openChat = () => router.push('/settings/feedback' as any);

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton icon="arrow-left" size={24} iconColor={theme.colors.onSurface} onPress={handleBack} style={styles.backButton} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Logo Placeholder */}
        <View style={styles.logoContainer}>
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoText}>SLOTLY</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>How can we help you?</Text>

        {/* Support Options */}
        <View style={styles.optionsContainer}>
          <TouchableRipple onPress={openChat} style={styles.optionButton} rippleColor="rgba(0, 0, 0, 0.1)">
            <View style={styles.optionContent}><Text style={styles.optionText}>Chat Support</Text><IconButton icon="chevron-right" size={20} /></View>
          </TouchableRipple>
          <TouchableRipple onPress={openMail} style={styles.optionButton} rippleColor="rgba(0, 0, 0, 0.1)">
            <View style={styles.optionContent}><Text style={styles.optionText}>Email Support</Text><IconButton icon="chevron-right" size={20} /></View>
          </TouchableRipple>
          <TouchableRipple onPress={openTel} style={styles.optionButton} rippleColor="rgba(0, 0, 0, 0.1)">
            <View style={styles.optionContent}><Text style={styles.optionText}>Phone Support</Text><IconButton icon="chevron-right" size={20} /></View>
          </TouchableRipple>

          {/* FAQs Button */}
          <TouchableRipple onPress={handleFAQs} style={styles.optionButton} rippleColor="rgba(0, 0, 0, 0.1)">
            <View style={styles.optionContent}>
              <Text style={styles.optionText}>FAQs</Text>
              <IconButton icon="chevron-right" size={20} style={styles.chevronIcon} />
            </View>
          </TouchableRipple>

          {/* Rate Us Button */}
          <TouchableRipple onPress={handleRateUs} style={styles.optionButton} rippleColor="rgba(0, 0, 0, 0.1)">
            <View style={styles.optionContent}>
              <View style={styles.rateUsContent}><Text style={styles.optionText}>Rate us</Text><Text style={styles.starIcon}>⭐</Text></View>
              <IconButton icon="chevron-right" size={20} style={styles.chevronIcon} />
            </View>
          </TouchableRipple>
          <Button mode="contained" style={{ marginTop: 16, borderRadius: 28 }} onPress={openChat}>Start Chat</Button>
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
    paddingBottom: 8,
  },
  backButton: {
    marginRight: 8,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  logoPlaceholder: {
    width: 80,
    height: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  logoText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ff69b4',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 32,
  },
  optionsContainer: {
    gap: 16,
  },
  optionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  optionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  rateUsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  starIcon: {
    fontSize: 18,
  },
  chevronIcon: {
    margin: 0,
  },
  bottomSpacing: {
    height: 40,
  },
});
