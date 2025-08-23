import React from 'react';
import { View, ScrollView, StyleSheet, Linking } from 'react-native';
import {
  Text,
  Surface,
  IconButton,
  TouchableRipple,
  useTheme,
  Card
} from 'react-native-paper';
import { useRouter } from 'expo-router';

export default function AboutUsScreen() {
  const theme = useTheme();
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  const openWebsite = () => Linking.openURL('https://slotly.app');
  const openTerms = () => Linking.openURL('https://slotly.app/terms');
  const openPrivacy = () => Linking.openURL('https://slotly.app/privacy');
  const openLicenses = () => Linking.openURL('https://slotly.app/licenses');

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton 
          icon="arrow-left" 
          size={24} 
          iconColor={theme.colors.onSurface} 
          onPress={handleBack} 
          style={styles.backButton} 
        />
        <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>About Us</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={{ padding: 16 }}>
          <Card style={{ marginBottom: 16 }}>
            <Card.Content>
              <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Slotly</Text>
              <Text style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}>Version 1.0.0</Text>
              <Text style={{ color: theme.colors.onSurfaceVariant }}>Connecting you with the best beauty and wellness services in Kenya.</Text>
            </Card.Content>
          </Card>
          
          <TouchableRipple onPress={openWebsite} style={styles.listItem} rippleColor="rgba(0,0,0,0.1)">
            <View style={styles.listItemContent}>
              <Text style={styles.listItemText}>Visit Website</Text>
              <IconButton icon="chevron-right" size={20} />
            </View>
          </TouchableRipple>
          
          <TouchableRipple onPress={openTerms} style={styles.listItem} rippleColor="rgba(0,0,0,0.1)">
            <View style={styles.listItemContent}>
              <Text style={styles.listItemText}>Terms of Service</Text>
              <IconButton icon="chevron-right" size={20} />
            </View>
          </TouchableRipple>
          
          <TouchableRipple onPress={openPrivacy} style={styles.listItem} rippleColor="rgba(0,0,0,0.1)">
            <View style={styles.listItemContent}>
              <Text style={styles.listItemText}>Privacy Policy</Text>
              <IconButton icon="chevron-right" size={20} />
            </View>
          </TouchableRipple>
          
          <TouchableRipple onPress={openLicenses} style={styles.listItem} rippleColor="rgba(0,0,0,0.1)">
            <View style={styles.listItemContent}>
              <Text style={styles.listItemText}>Open Source Licenses</Text>
              <IconButton icon="chevron-right" size={20} />
            </View>
          </TouchableRipple>
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
    flex: 1,
    textAlign: 'center',
    marginRight: 48, // Compensate for back button width
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listItem: {
    backgroundColor: 'transparent',
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  listItemText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  bottomSpacing: {
    height: 40,
  },
});