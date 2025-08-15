import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import {
  Text,
  Surface,
  IconButton,
  List,
  useTheme
} from 'react-native-paper';
import { useRouter } from 'expo-router';

interface FAQ {
  id: string;
  question: string;
  answer: string;
}

export default function FAQsScreen() {
  const theme = useTheme();
  const router = useRouter();
  
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const faqs: FAQ[] = [
    {
      id: '1',
      question: 'How do I schedule/reschedule/cancel an appointment?',
      answer: 'To schedule an appointment, browse services and select your preferred time slot. To reschedule or cancel, go to "My Appointments" in your profile, select the appointment, and choose the appropriate option. Cancellations must be made at least 24 hours in advance to avoid charges.'
    },
    {
      id: '2',
      question: "Why can't I see available time slots?",
      answer: 'Available time slots may not appear due to several reasons: the service provider may be fully booked, you might be viewing dates too far in advance, or there could be a connectivity issue. Try refreshing the page, checking your internet connection, or selecting a different date.'
    },
    {
      id: '3',
      question: 'How do I view my appointment history?',
      answer: 'You can view your appointment history by going to your Profile, then selecting "My Appointments" or "Booking History". Here you\'ll find all your past, current, and upcoming appointments with details like service provider, date, time, and payment status.'
    },
    {
      id: '4',
      question: "I didn't receive a confirmation email/reminder.",
      answer: 'If you didn\'t receive a confirmation email, first check your spam/junk folder. Ensure your email address is correct in your account settings. You can also enable push notifications in the app settings to receive reminders directly on your phone.'
    },
    {
      id: '5',
      question: 'What payment methods do you accept?',
      answer: 'We accept various payment methods including M-Pesa, credit/debit cards (Visa, Mastercard), and bank transfers. You can add and manage your payment methods in the "Payment Details" section of your account settings.'
    },
    {
      id: '6',
      question: 'Can I book recurring appointments?',
      answer: 'Yes, you can book recurring appointments for regular services. When booking, look for the "Repeat" or "Recurring" option and select your preferred frequency (weekly, bi-weekly, monthly). You can modify or cancel recurring appointments at any time.'
    },
    {
      id: '7',
      question: 'How do I sync appointments with my personal calendar?',
      answer: 'To sync appointments with your personal calendar, go to Settings > Calendar Integration. You can connect your Google Calendar, Apple Calendar, or Outlook. Once connected, all your appointments will automatically appear in your chosen calendar app.'
    },
    {
      id: '8',
      question: 'How do I update my account information?',
      answer: 'To update your account information, go to your Profile and select "Account Details". Here you can edit your name, email, phone number, and other personal information. Don\'t forget to save your changes after making updates.'
    },
    {
      id: '9',
      question: 'How secure is my personal information?',
      answer: 'We take your privacy and security seriously. All personal information is encrypted and stored securely. We comply with data protection regulations and never share your information with third parties without your consent. You can review our Privacy Policy for more details.'
    },
    {
      id: '10',
      question: "The calendar isn't displaying correctly on my device.",
      answer: 'If the calendar isn\'t displaying correctly, try these steps: 1) Update the app to the latest version, 2) Restart the app, 3) Check your device\'s date and time settings, 4) Clear the app cache. If the issue persists, contact our support team with your device model and operating system version.'
    }
  ];

  const handleBack = () => {
    router.back();
  };

  const handleAccordionPress = (id: string) => {
    setExpandedItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
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
        <Text style={styles.headerTitle}>FAQs</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.faqContainer}>
          {faqs.map((faq) => (
            <Surface key={faq.id} style={styles.faqItem} elevation={2}>
              <List.Accordion
                title={faq.question}
                titleStyle={styles.questionText}
                style={styles.accordion}
                expanded={expandedItems.includes(faq.id)}
                onPress={() => handleAccordionPress(faq.id)}
                left={(props) => null} // Remove default left icon
                right={(props) => (
                  <List.Icon 
                    {...props} 
                    icon={expandedItems.includes(faq.id) ? "chevron-up" : "chevron-down"}
                    color="#333"
                  />
                )}
              >
                <List.Item
                  title={faq.answer}
                  titleStyle={styles.answerText}
                  titleNumberOfLines={0}
                  style={styles.answerContainer}
                />
              </List.Accordion>
            </Surface>
          ))}
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
  faqContainer: {
    paddingTop: 8,
    gap: 12,
  },
  faqItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  accordion: {
    backgroundColor: 'transparent',
    paddingVertical: 4,
  },
  questionText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    lineHeight: 22,
    paddingRight: 8,
  },
  answerContainer: {
    paddingTop: 0,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  answerText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    fontWeight: '400',
  },
  bottomSpacing: {
    height: 32,
  },
});