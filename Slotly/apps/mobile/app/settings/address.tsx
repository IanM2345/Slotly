import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Surface,
  IconButton,
  Menu,
  useTheme,
  Snackbar
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { getAddress, updateAddress } from '../../lib/settings/api';
import type { Address as AddressType } from '../../lib/settings/types';

export default function AddressScreen() {
  const theme = useTheme();
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [addressData, setAddressData] = useState<AddressType>({ country: '', city: '', constituency: '', street: '', apartment: '' });
  const [snack, setSnack] = useState<{ visible: boolean; msg: string }>({ visible: false, msg: '' });

  useEffect(() => {
    getAddress().then((addr) => setAddressData({
      country: addr.country ?? 'Kenya',
      city: addr.city ?? '',
      constituency: addr.constituency ?? '',
      street: addr.street ?? '',
      apartment: addr.apartment ?? ''
    })).catch(() => {});
  }, []);

  // Menu states
  const [countyMenuVisible, setCountyMenuVisible] = useState(false);
  const [constituencyMenuVisible, setConstituencyMenuVisible] = useState(false);

  // Sample data - replace with actual data
  const counties = ['Nairobi','Mombasa','Kisumu','Nakuru','Eldoret','Thika','Malindi','Kitale'];

  const constituencies = [
    'Westlands',
    'Langata',
    'Kasarani',
    'Embakasi',
    'Dagoretti',
    'Kibra',
    'Mathare',
    'Starehe'
  ];

  const handleBack = () => {
    router.back();
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateAddress(addressData);
      setSnack({ visible: true, msg: 'Address saved' });
      setTimeout(() => router.back(), 800);
    } catch (error) {
      console.error('Error saving address:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateAddressData = (field: keyof AddressType, value: string) => {
    setAddressData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCountySelect = (county: string) => {
    updateAddressData('country', county);
    setCountyMenuVisible(false);
  };

  const handleConstituencySelect = (constituency: string) => {
    updateAddressData('constituency', constituency);
    setConstituencyMenuVisible(false);
  };

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton icon="arrow-left" size={24} iconColor={theme.colors.onSurface} onPress={handleBack} />
        <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>Address</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.formContainer}>
          {/* County Dropdown */}
          <View style={styles.inputContainer}>
            <Menu
              visible={countyMenuVisible}
              onDismiss={() => setCountyMenuVisible(false)}
              anchor={
                <TextInput
                  mode="outlined"
                  label="County"
                  value={addressData.country}
                  style={styles.textInput}
                  outlineColor={theme.colors.outline}
                  activeOutlineColor={theme.colors.primary}
                  textColor={theme.colors.onSurface}
                  editable={false}
                  right={
                 <TextInput.Icon icon="chevron-down" onPress={() => setCountyMenuVisible(true)} />
                  }
                  onPressIn={() => setCountyMenuVisible(true)}
                />
              }
              contentStyle={styles.menuContent}
            >
              {counties.map((county) => (
                <Menu.Item
                  key={county}
                  onPress={() => handleCountySelect(county)}
                  title={county}
                  titleStyle={styles.menuItemText}
                />
              ))}
            </Menu>
          </View>

          {/* City Input */}
          <TextInput
            mode="outlined"
            label="City (Optional)"
            value={addressData.city ?? ''}
            onChangeText={(text) => updateAddressData('city', text)}
            style={styles.textInput}
            outlineColor={theme.colors.outline}
            activeOutlineColor={theme.colors.primary}
            textColor={theme.colors.onSurface}
            autoCapitalize="words"
          />

          {/* Constituency Dropdown */}
          <View style={styles.inputContainer}>
            <Menu
              visible={constituencyMenuVisible}
              onDismiss={() => setConstituencyMenuVisible(false)}
              anchor={
                <TextInput
                  mode="outlined"
                  label="Constituency"
                  value={addressData.constituency ?? ''}
                  style={styles.textInput}
                  outlineColor={theme.colors.outline}
                  activeOutlineColor={theme.colors.primary}
                  textColor={theme.colors.onSurface}
                  editable={false}
                  right={
                    <TextInput.Icon icon="chevron-down" onPress={() => setConstituencyMenuVisible(true)} />
                  }
                  onPressIn={() => setConstituencyMenuVisible(true)}
                />
              }
              contentStyle={styles.menuContent}
            >
              {constituencies.map((constituency) => (
                <Menu.Item
                  key={constituency}
                  onPress={() => handleConstituencySelect(constituency)}
                  title={constituency}
                  titleStyle={styles.menuItemText}
                />
              ))}
            </Menu>
          </View>

          {/* Street Input */}
          <TextInput
            mode="outlined"
            label="Street"
            value={addressData.street ?? ''}
            onChangeText={(text) => updateAddressData('street', text)}
            style={styles.textInput}
            outlineColor={theme.colors.outline}
            activeOutlineColor={theme.colors.primary}
            textColor={theme.colors.onSurface}
            autoCapitalize="words"
          />

          {/* Apartment/House Number Input */}
          <TextInput
            mode="outlined"
            label="Apartment/House Number (Optional)"
            value={addressData.apartment ?? ''}
            onChangeText={(text) => updateAddressData('apartment', text)}
            style={styles.textInput}
            outlineColor={theme.colors.outline}
            activeOutlineColor={theme.colors.primary}
            textColor={theme.colors.onSurface}
            autoCapitalize="characters"
          />
        </View>

        {/* Save Button */}
        <View style={styles.saveButtonContainer}>
          <Button
            mode="contained"
            onPress={handleSave}
            loading={loading}
            disabled={loading}
            style={styles.saveButton}
            labelStyle={styles.saveButtonText}
            contentStyle={styles.saveButtonContent}
          >
            Save
          </Button>
        </View>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
      <Snackbar visible={snack.visible} onDismiss={() => setSnack({ visible: false, msg: '' })} duration={2000}>{snack.msg}</Snackbar>
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
    paddingBottom: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 48,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  formContainer: {
    paddingTop: 24,
    gap: 20,
    marginBottom: 40,
  },
  inputContainer: {
    position: 'relative',
  },
  textInput: {
    backgroundColor: 'transparent',
  },
  menuContent: {
    maxHeight: 200,
  },
  menuItemText: {
    fontSize: 16,
  },
  saveButtonContainer: {
    marginBottom: 24,
  },
  saveButton: {
    borderRadius: 25,
  },
  saveButtonContent: {
    paddingVertical: 12,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  bottomSpacing: {
    height: 32,
  },
});