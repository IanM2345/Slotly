import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import {
  Text,
  Surface,
  IconButton,
  Button,
  useTheme,
  Snackbar
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { listGiftCards, purchaseGiftCard } from '../../lib/settings/api';
import type { GiftCard } from '../../lib/settings/types';

type TabType = 'active' | 'archive';

export default function GiftCardsScreen() {
  const theme = useTheme();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [snack, setSnack] = useState<{ visible: boolean; msg: string }>({ visible: false, msg: '' });
  useEffect(() => { listGiftCards().then(setCards).catch(() => {}); }, []);

  const handleBack = () => {
    router.back();
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton icon="arrow-left" size={24} iconColor={theme.colors.onSurface} onPress={handleBack} style={styles.backButton} />
        <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>My Gift Cards</Text>
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
          {cards.filter(c => c.status === (activeTab === 'active' ? 'active' : 'archived')).map(c => (
            <View key={c.id} style={{ borderWidth: 1, borderColor: theme.colors.outline, borderRadius: 12, padding: 12, marginBottom: 8 }}>
              <Text style={{ fontWeight: '700' }}>{c.label}</Text>
              <Text style={{ color: theme.colors.onSurfaceVariant }}>Balance: KSh {c.balance}</Text>
              <Text style={{ color: theme.colors.onSurfaceVariant }}>Status: {c.status}</Text>
            </View>
          ))}
          <Button mode="contained" style={{ marginTop: 12, borderRadius: 24 }} onPress={async () => { const card: GiftCard = { id: Date.now().toString(), label: 'Gift Card', balance: 1000, status: 'active' }; await purchaseGiftCard(card); const refreshed = await listGiftCards(); setCards(refreshed); setSnack({ visible: true, msg: 'Gift card purchased' }); }}>Purchase Gift Card</Button>
        </View>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
      <Snackbar visible={snack.visible} onDismiss={() => setSnack({ visible: false, msg: '' })} duration={2000}>{snack.msg}</Snackbar>
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
  tabContainer: {
    marginTop: 20,
    marginBottom: 24,
  },
  tabButtons: { flexDirection: 'row', borderRadius: 25, padding: 4 },
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
  activeTabButton: {},
  inactiveTabButton: {},
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
  inactiveTabText: {},
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
  emptyStateText: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  emptyStateSubtext: { fontSize: 14, textAlign: 'center' },
  bottomSpacing: {
    height: 40,
  },
});
