import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Surface,
  IconButton,
  SegmentedButtons,
  useTheme
} from 'react-native-paper';
import { useRouter } from 'expo-router';

export default function AccountDetailsScreen() {
  const theme = useTheme();
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    fullName: 'John Doe',
    email: 'john.doe@email.com',
    phoneNumber: '+254712345678',
    dateOfBirth: '1990-01-15'
  });
  
  const [serviceType, setServiceType] = useState('everyone');
  const [loading, setLoading] = useState(false);

  const handleBack = () => {
    router.back();
  };

  const handleSaveChanges = async () => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Saving account details:', { ...formData, serviceType });
      // Show success message or navigate back
      router.back();
    } catch (error) {
      console.error('Error saving account details:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
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
        <Text style={styles.headerTitle}>Account Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Personal Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Details</Text>
          
          <View style={styles.formContainer}>
            <TextInput
              mode="outlined"
              label="Full Name"
              value={formData.fullName}
              onChangeText={(text) => updateFormData('fullName', text)}
              style={styles.textInput}
              outlineColor="#333"
              activeOutlineColor="#333"
              textColor="#333"
              autoCapitalize="words"
            />

            <TextInput
              mode="outlined"
              label="Email"
              value={formData.email}
              onChangeText={(text) => updateFormData('email', text)}
              style={styles.textInput}
              outlineColor="#333"
              activeOutlineColor="#333"
              textColor="#333"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TextInput
              mode="outlined"
              label="Phone Number"
              value={formData.phoneNumber}
              onChangeText={(text) => updateFormData('phoneNumber', text)}
              style={styles.textInput}
              outlineColor="#333"
              activeOutlineColor="#333"
              textColor="#333"
              keyboardType="phone-pad"
            />

            <TextInput
              mode="outlined"
              label="Date of Birth"
              value={formData.dateOfBirth}
              onChangeText={(text) => updateFormData('dateOfBirth', text)}
              style={styles.textInput}
              outlineColor="#333"
              activeOutlineColor="#333"
              textColor="#333"
              placeholder="YYYY-MM-DD"
            />
          </View>
        </View>

        {/* Service Type Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Type</Text>
          
          <View style={styles.serviceTypeContainer}>
            <SegmentedButtons
              value={serviceType}
              onValueChange={setServiceType}
              buttons={[
                {
                  value: 'women',
                  label: 'Women',
                  style: styles.segmentButton
                },
                {
                  value: 'men',
                  label: 'Men',
                  style: styles.segmentButton
                },
                {
                  value: 'everyone',
                  label: 'Everyone',
                  style: styles.segmentButton
                }
              ]}
              style={styles.segmentedButtons}
            />
          </View>
        </View>

        {/* Save Button */}
        <View style={styles.saveButtonContainer}>
          <Button
            mode="contained"
            onPress={handleSaveChanges}
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
    backgroundColor: '#ffc0cb', // Light pink background
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
    width: 48, // Same width as IconButton to center title
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
  formContainer: {
    gap: 16,
  },
  textInput: {
    backgroundColor: 'rgba(255, 192, 203, 0.7)',
  },
  serviceTypeContainer: {
    marginTop: 8,
  },
  segmentedButtons: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#333',
  },
  segmentButton: {
    borderColor: '#333',
  },
  saveButtonContainer: {
    marginTop: 40,
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