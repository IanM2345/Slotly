import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import {
  Text,
  Surface,
  List,
  Switch,
  Divider,
  IconButton,
  TouchableRipple,
  useTheme
} from 'react-native-paper';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const handleBack = () => {
    router.back();
  };

  const handleNavigation = (route: string) => {
    router.push(route as any);
  };

  const handleLogout = () => {
    // Handle logout logic here
    console.log('Logging out...');
    // router.replace('/login');
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
        />
        <View style={styles.headerContent}>
          <IconButton
            icon="cog"
            size={28}
            iconColor="#333"
            style={styles.gearIcon}
          />
          <Text style={styles.headerTitle}>Settings</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Personal Information Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          
          <TouchableRipple
            onPress={() => handleNavigation('/account-details')}
            rippleColor="rgba(0, 0, 0, 0.1)"
          >
            <List.Item
              title="Account Details"
              titleStyle={styles.listItemTitle}
              style={styles.listItem}
            />
          </TouchableRipple>

          <TouchableRipple
            onPress={() => handleNavigation('/payment-details')}
            rippleColor="rgba(0, 0, 0, 0.1)"
          >
            <List.Item
              title="Payment Details"
              titleStyle={styles.listItemTitle}
              style={styles.listItem}
            />
          </TouchableRipple>

          <TouchableRipple
            onPress={() => handleNavigation('/family-friends')}
            rippleColor="rgba(0, 0, 0, 0.1)"
          >
            <List.Item
              title="Family and Friends"
              titleStyle={styles.listItemTitle}
              style={styles.listItem}
            />
          </TouchableRipple>

          <TouchableRipple
            onPress={() => handleNavigation('/address')}
            rippleColor="rgba(0, 0, 0, 0.1)"
          >
            <List.Item
              title="Address"
              titleStyle={styles.listItemTitle}
              style={styles.listItem}
            />
          </TouchableRipple>
        </View>

        {/* Notification Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification</Text>
          
          <View style={styles.notificationRow}>
            <Text style={styles.notificationText}>Turn on notifications</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              color="#ff69b4"
            />
          </View>
        </View>

        {/* Language Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Language</Text>
          
          <TouchableRipple
            onPress={() => handleNavigation('/language-settings')}
            rippleColor="rgba(0, 0, 0, 0.1)"
          >
            <View style={styles.languageItem}>
              <View>
                <Text style={styles.languageLabel}>Language:</Text>
                <Text style={styles.languageValue}>Automatic(English)</Text>
              </View>
              <IconButton
                icon="chevron-right"
                size={24}
                iconColor="#333"
              />
            </View>
          </TouchableRipple>

          <TouchableRipple
            onPress={() => handleNavigation('/country-settings')}
            rippleColor="rgba(0, 0, 0, 0.1)"
          >
            <View style={styles.languageItem}>
              <View>
                <Text style={styles.languageLabel}>Country:</Text>
                <Text style={styles.languageValue}>Kenya</Text>
              </View>
              <IconButton
                icon="chevron-right"
                size={24}
                iconColor="#333"
              />
            </View>
          </TouchableRipple>
        </View>

        {/* Others Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Others</Text>
          
          <TouchableRipple
            onPress={() => handleNavigation('/change-password')}
            rippleColor="rgba(0, 0, 0, 0.1)"
          >
            <View style={styles.othersItem}>
              <Text style={styles.othersText}>Change Password</Text>
              <IconButton
                icon="chevron-right"
                size={24}
                iconColor="#333"
              />
            </View>
          </TouchableRipple>

          <TouchableRipple
            onPress={() => handleNavigation('/reviews')}
            rippleColor="rgba(0, 0, 0, 0.1)"
          >
            <List.Item
              title="Reviews"
              titleStyle={styles.listItemTitle}
              style={styles.listItem}
            />
          </TouchableRipple>

          <TouchableRipple
            onPress={() => handleNavigation('/support')}
            rippleColor="rgba(0, 0, 0, 0.1)"
          >
            <List.Item
              title="Support"
              titleStyle={styles.listItemTitle}
              style={styles.listItem}
            />
          </TouchableRipple>

          <TouchableRipple
            onPress={() => handleNavigation('/feedback')}
            rippleColor="rgba(0, 0, 0, 0.1)"
          >
            <List.Item
              title="feedback"
              titleStyle={styles.listItemTitle}
              style={styles.listItem}
            />
          </TouchableRipple>

          <TouchableRipple
            onPress={() => handleNavigation('/gift-cards')}
            rippleColor="rgba(0, 0, 0, 0.1)"
          >
            <List.Item
              title="Gift Cards"
              titleStyle={styles.listItemTitle}
              style={styles.listItem}
            />
          </TouchableRipple>

          <TouchableRipple
            onPress={() => handleNavigation('/about')}
            rippleColor="rgba(0, 0, 0, 0.1)"
          >
            <List.Item
              title="About"
              titleStyle={styles.listItemTitle}
              style={styles.listItem}
            />
          </TouchableRipple>
        </View>

        {/* Logout Section */}
        <View style={styles.logoutSection}>
          <TouchableRipple
            onPress={handleLogout}
            rippleColor="rgba(0, 0, 0, 0.1)"
          >
            <View style={styles.logoutItem}>
              <Text style={styles.logoutText}>Log Out</Text>
              <IconButton
                icon="arrow-right"
                size={24}
                iconColor="#333"
              />
            </View>
          </TouchableRipple>
        </View>

        {/* Bottom spacing for safe area */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffc0cb', // Light pink background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#ffc0cb',
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 48, // Compensate for back button width
  },
  gearIcon: {
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  listItem: {
    paddingHorizontal: 0,
    paddingVertical: 8,
  },
  listItemTitle: {
    fontSize: 16,
    color: '#333',
    fontWeight: '400',
  },
  notificationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  notificationText: {
    fontSize: 16,
    color: '#333',
  },
  languageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  languageLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  languageValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  othersItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  othersText: {
    fontSize: 16,
    color: '#333',
  },
  logoutSection: {
    marginTop: 16,
    marginBottom: 24,
  },
  logoutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  logoutText: {
    fontSize: 18,
    color: '#333',
    fontWeight: '500',
  },
  bottomSpacing: {
    height: 32,
  },
});