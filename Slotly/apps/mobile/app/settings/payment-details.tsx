import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Surface,
  IconButton,
  RadioButton,
  Card,
  useTheme
} from 'react-native-paper';
import { useRouter } from 'expo-router';

type PaymentMethod = 'card' | 'mpesa';

export default function PaymentDetailsScreen() {
  const theme = useTheme();
  const router = useRouter();
  
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [loading, setLoading] = useState(false);
  
  // Card details state
  const [cardDetails, setCardDetails] = useState({
    cardNumber: '',
    expiryDate: '',
    securityCode: ''
  });
  
  // M-Pesa details state
  const [mpesaDetails, setMpesaDetails] = useState({
    phoneNumber: ''
  });

  const handleBack = () => {
    router.back();
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const paymentData = paymentMethod === 'card' ? cardDetails : mpesaDetails;
      console.log('Saving payment details:', { method: paymentMethod, ...paymentData });
      
      // Navigate back or show success message
      router.back();
    } catch (error) {
      console.error('Error saving payment details:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateCardDetails = (field: keyof typeof cardDetails, value: string) => {
    setCardDetails(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updateMpesaDetails = (field: keyof typeof mpesaDetails, value: string) => {
    setMpesaDetails(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const formatCardNumber = (text: string) => {
    // Remove all non-digit characters
    const cleaned = text.replace(/\D/g, '');
    // Add spaces every 4 digits
    const formatted = cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
    return formatted.substring(0, 19); // Limit to 16 digits + 3 spaces
  };

  const formatExpiryDate = (text: string) => {
    // Remove all non-digit characters
    const cleaned = text.replace(/\D/g, '');
    // Add slash after 2 digits
    if (cleaned.length >= 2) {
      return cleaned.substring(0, 2) + '/' + cleaned.substring(2, 4);
    }
    return cleaned;
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
        <Text style={styles.headerTitle}>Payment Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Payment Methods Button */}
        <View style={styles.methodsButtonContainer}>
          <Button
            mode="contained"
            style={styles.methodsButton}
            labelStyle={styles.methodsButtonText}
            contentStyle={styles.methodsButtonContent}
          >
            Payment Methods
          </Button>
        </View>

        {/* Payment Method Selection */}
        <Card style={styles.selectionCard} mode="outlined">
          <Card.Content style={styles.selectionContent}>
            <RadioButton.Group
              onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
              value={paymentMethod}
            >
              <View style={styles.radioOption}>
                <View style={styles.radioRow}>
                  <RadioButton value="card" color="#ff69b4" />
                  <Text style={styles.radioLabel}>Credit or debit card</Text>
                </View>
              </View>
              
              <View style={styles.divider} />
              
              <View style={styles.radioOption}>
                <View style={styles.radioRow}>
                  <RadioButton value="mpesa" color="#ff69b4" />
                  <Text style={styles.radioLabel}>Mpesa</Text>
                </View>
              </View>
            </RadioButton.Group>
          </Card.Content>
        </Card>

        {/* Payment Details Form */}
        <View style={styles.formContainer}>
          {paymentMethod === 'card' ? (
            // Card Details Form
            <View style={styles.cardForm}>
              <TextInput
                mode="outlined"
                label="Card Number"
                value={cardDetails.cardNumber}
                onChangeText={(text) => updateCardDetails('cardNumber', formatCardNumber(text))}
                style={styles.textInput}
                outlineColor="#333"
                activeOutlineColor="#333"
                textColor="#333"
                keyboardType="numeric"
                maxLength={19}
                right={<TextInput.Icon icon="lock" color="#666" />}
              />

              <View style={styles.cardRow}>
                <TextInput
                  mode="outlined"
                  label="Expiry Date"
                  value={cardDetails.expiryDate}
                  onChangeText={(text) => updateCardDetails('expiryDate', formatExpiryDate(text))}
                  style={[styles.textInput, styles.halfWidth]}
                  outlineColor="#333"
                  activeOutlineColor="#333"
                  textColor="#333"
                  keyboardType="numeric"
                  maxLength={5}
                  placeholder="MM/YY"
                />

                <TextInput
                  mode="outlined"
                  label="Security Code"
                  value={cardDetails.securityCode}
                  onChangeText={(text) => updateCardDetails('securityCode', text.replace(/\D/g, '').substring(0, 4))}
                  style={[styles.textInput, styles.halfWidth]}
                  outlineColor="#333"
                  activeOutlineColor="#333"
                  textColor="#333"
                  keyboardType="numeric"
                  maxLength={4}
                  secureTextEntry
                  right={<TextInput.Icon icon="help-circle" color="#666" />}
                />
              </View>
            </View>
          ) : (
            // M-Pesa Form
            <View style={styles.mpesaForm}>
              <TextInput
                mode="outlined"
                label="Phone Number"
                value={mpesaDetails.phoneNumber}
                onChangeText={(text) => updateMpesaDetails('phoneNumber', text)}
                style={styles.textInput}
                outlineColor="#333"
                activeOutlineColor="#333"
                textColor="#333"
                keyboardType="phone-pad"
                placeholder="+254 712 345 678"
              />
            </View>
          )}
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
  methodsButtonContainer: {
    marginTop: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  methodsButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 25,
  },
  methodsButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  methodsButtonContent: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  selectionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderColor: '#333',
    borderWidth: 2,
    marginBottom: 24,
  },
  selectionContent: {
    padding: 0,
  },
  radioOption: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioLabel: {
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginHorizontal: 16,
  },
  formContainer: {
    marginBottom: 32,
  },
  cardForm: {
    gap: 16,
  },
  cardRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  mpesaForm: {
    gap: 16,
  },
  textInput: {
    backgroundColor: 'rgba(255, 192, 203, 0.7)',
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