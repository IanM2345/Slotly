import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Surface, IconButton, TouchableRipple } from 'react-native-paper';
import { useRouter } from 'expo-router';

interface AboutItem {
  id: string;
  title: string;
  route: string;
}

export default function AboutUsScreen() {
  const router = useRouter();

  const aboutItems: AboutItem[] = [
    { id: '1', title: 'Slotly Website', route: '/settings/website' },
    { id: '2', title: 'Terms of Service', route: '/settings/terms-of-service' },
    { id: '3', title: 'Privacy Policy', route: '/settings/privacy-policy' },
    { id: '4', title: 'Licenses', route: '/settings/licenses' },
  ];

  const handleBack = () => {
    router.back();
  };

  const handleItemPress = (route: string) => {
    router.push(route as any);
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
        <Text style={styles.headerTitle}>About Us</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.listContainer}>
          {aboutItems.map((item, index) => (
            <View key={item.id}>
              <TouchableRipple
                onPress={() => handleItemPress(item.route)}
                style={styles.listItem}
                rippleColor="rgba(0, 0, 0, 0.1)"
              >
                <View style={styles.listItemContent}>
                  <Text style={styles.listItemText}>{item.title}</Text>
                  <IconButton
                    icon="chevron-right"
                    size={20}
                    iconColor="#666"
                    style={styles.chevronIcon}
                  />
                </View>
              </TouchableRipple>
              {index < aboutItems.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffc0cb' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: 16, paddingBottom: 16 },
  backButton: { marginRight: 8 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#333', flex: 1, textAlign: 'center', marginRight: 48 },
  scrollView: { flex: 1, paddingHorizontal: 16 },
  listContainer: {
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
  listItem: { backgroundColor: 'transparent' },
  listItemContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 18, paddingHorizontal: 20 },
  listItemText: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  chevronIcon: { margin: 0 },
  divider: { height: 1, backgroundColor: '#e0e0e0', marginHorizontal: 20 },
  bottomSpacing: { height: 40 },
});