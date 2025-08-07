import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import {
  Text,
  Surface,
  IconButton,
  Button,
  useTheme
} from 'react-native-paper';
import { useRouter } from 'expo-router';

type TabType = 'active' | 'archive';

export default function GiftCardsScreen() {
  const theme = useTheme();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<TabType>('active');

  const handleBack = () => {
    router.back();
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
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
        <Text style={styles.headerTitle}>My Gift Cards</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Tab Container */}
        <View style={styles.tabContainer}>
          <View style={styles.tabButtons}>
            <Button
              mode={activeTab === 'active' ? 'contained' : 'outlined'}
              onPress={() => handleTabChange('active')}
              style={[
                styles.tabButton,
                styles.leftTab,
                activeTab === 'active' ? styles.activeTabButton : styles.inactiveTabButton
              ]}
              labelStyle={[
                styles.tabButtonText,
                activeTab === 'active' ? styles.activeTabText : styles.inactiveTabText
              ]}
              contentStyle={styles.tabButtonContent}
            >
              Active
            </Button>
            <Button
              mode={activeTab === 'archive' ? 'contained' : 'outlined'}
              onPress={() => handleTabChange('archive')}
              style={[
                styles.tabButton,
                styles.rightTab,
                activeTab === 'archive' ? styles.activeTabButton : styles.inactiveTabButton
              ]}
              labelStyle={[
                styles.tabButtonText,
                activeTab === 'archive' ? styles.activeTabText : styles.inactiveTabText
              ]}
              contentStyle={styles.tabButtonContent}
            >
              Archive
            </Button>
          </View>
        </View>

        {/* Content Area */}
        <View style={styles.contentContainer}>
          {activeTab === 'active' ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No active gift cards</Text>
              <Text style={styles.emptyStateSubtext}>
                Your active gift cards will appear here
              </Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No archived gift cards</Text>
              <Text style={styles.emptyStateSubtext}>
                Your archived gift cards will appear here
              </Text>
            </View>
          )}
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
  tabContainer: {
    marginTop: 20,
    marginBottom: 24,
  },
  tabButtons: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 25,
    padding: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tabButton: {
    flex: 1,
    margin: 0,
  },
  leftTab: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  rightTab: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  activeTabButton: {
    backgroundColor: '#ff69b4',
    borderColor: '#ff69b4',
  },
  inactiveTabButton: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  tabButtonContent: {
    paddingVertical: 8,
  },
  tabButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#fff',
  },
  inactiveTabText: {
    color: '#333',
  },
  contentContainer: {
    flex: 1,
    minHeight: 300,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  bottomSpacing: {
    height: 40,
  },
});
