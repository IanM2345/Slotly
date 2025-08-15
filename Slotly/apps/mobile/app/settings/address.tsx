import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Surface,
  IconButton,
  Menu,
  useTheme
} from 'react-native-paper';
import { useRouter } from 'expo-router';

interface AddressData {
  county: string;
  city: string;
  constituency: string;
  street: string;
  apartmentNumber: string;
}

export default function AddressScreen() {
  const theme = useTheme();
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [addressData, setAddressData] = useState<AddressData>({
    county: '',
    city: '',
    constituency: '',
    street: '',
    apartmentNumber: ''
  });

  // Menu states
  const [countyMenuVisible, setCountyMenuVisible] = useState(false);
  const [constituencyMenuVisible, setConstituencyMenuVisible] = useState(false);

  // Sample data - replace with actual data
  const counties = [
    'Nairobi',
    'Mombasa',
    'Kisumu',
    'Nakuru',
    'Eldoret',
    'Thika',
    'Malindi',
    'Kitale'
  ];

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
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('Saving address:', addressData);
      
      // Navigate back or show success message
      router.back();
    } catch (error) {
      console.error('Error saving address:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateAddressData = (field: keyof AddressData, value: string) => {
    setAddressData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCountySelect = (county: string) => {
    updateAddressData('county', county);
    setCountyMenuVisible(false);
  };

  const handleConstituencySelect = (constituency: string) => {
    updateAddressData('constituency', constituency);
    setConstituencyMenuVisible(false);
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
        <Text style={styles.headerTitle}>Address</Text>
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
                  value={addressData.county}
                  style={styles.textInput}
                  outlineColor="#333"
                  activeOutlineColor="#333"
                  textColor="#333"
                  editable={false}
                  right={
                 <TextInput.Icon 
  icon="chevron-down" 
  color="#666"
  onPress={() => setCountyMenuVisible(true)}
/>
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
            value={addressData.city}
            onChangeText={(text) => updateAddressData('city', text)}
            style={styles.textInput}
            outlineColor="#333"
            activeOutlineColor="#333"
            textColor="#333"
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
                  value={addressData.constituency}
                  style={styles.textInput}
                  outlineColor="#333"
                  activeOutlineColor="#333"
                  textColor="#333"
                  editable={false}
                  right={
                    <TextInput.Icon 
  icon="chevron-down" 
  onPress={() => setConstituencyMenuVisible(true)}
  color="#666"
/>
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
            value={addressData.street}
            onChangeText={(text) => updateAddressData('street', text)}
            style={styles.textInput}
            outlineColor="#333"
            activeOutlineColor="#333"
            textColor="#333"
            autoCapitalize="words"
          />

          {/* Apartment/House Number Input */}
          <TextInput
            mode="outlined"
            label="Apartment/House Number (Optional)"
            value={addressData.apartmentNumber}
            onChangeText={(text) => updateAddressData('apartmentNumber', text)}
            style={styles.textInput}
            outlineColor="#333"
            activeOutlineColor="#333"
            textColor="#333"
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
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4a3c3', // Pink background
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
    color: '#333',
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
    backgroundColor: 'rgba(255, 192, 203, 0.7)',
  },
  menuContent: {
    backgroundColor: '#fff',
    maxHeight: 200,
  },
  menuItemText: {
    color: '#333',
    fontSize: 16,
  },
  saveButtonContainer: {
    marginBottom: 24,
  },
  saveButton: {
    backgroundColor: '#ff69b4',
    borderRadius: 25,
  },
  saveButtonContent: {
    paddingVertical: 12,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  bottomSpacing: {
    height: 32,
  },
});