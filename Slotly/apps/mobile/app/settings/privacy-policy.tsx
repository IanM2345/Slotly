import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import {
  Text,
  Surface,
  IconButton,
  useTheme
} from 'react-native-paper';
import { useRouter } from 'expo-router';

export default function PrivacyPolicyScreen() {
  const theme = useTheme();
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  const privacyPolicyText = `
Last updated: January 2024

At Slotly, we are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and services.

INFORMATION WE COLLECT

Personal Information
We may collect personal information that you provide directly to us, including:
• Name and contact information (email address, phone number)
• Profile information and preferences
• Payment information (processed securely through third-party providers)
• Appointment and booking history
• Communication preferences

Usage Information
We automatically collect certain information about your use of our services:
• Device information (device type, operating system, unique device identifiers)
• Usage patterns and preferences
• Location information (with your permission)
• Log data and analytics information

HOW WE USE YOUR INFORMATION

We use the information we collect to:
• Provide and maintain our services
• Process bookings and appointments
• Send you confirmations, reminders, and updates
• Improve our services and user experience
• Communicate with you about our services
• Comply with legal obligations

INFORMATION SHARING

We do not sell, trade, or rent your personal information to third parties. We may share your information in the following circumstances:
• With service providers who assist us in operating our platform
• With business partners (salons, spas) to fulfill your bookings
• When required by law or to protect our rights
• In connection with a business transaction (merger, acquisition)

DATA SECURITY

We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet is 100% secure.

YOUR RIGHTS

You have the right to:
• Access and update your personal information
• Delete your account and associated data
• Opt-out of marketing communications
• Request a copy of your data

CONTACT US

If you have any questions about this Privacy Policy, please contact us at:
Email: privacy@slotly.com
Phone: +254 700 000 000

This Privacy Policy may be updated from time to time. We will notify you of any material changes by posting the new Privacy Policy on this page.
  `;

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
        <Text style={styles.headerTitle}>Privacy Policy</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.contentContainer}>
          <Text style={styles.contentText}>{privacyPolicyText}</Text>
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
  contentContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  contentText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#333',
    textAlign: 'justify',
  },
  bottomSpacing: {
    height: 40,
  },
});
