import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Surface,
  IconButton,
  RadioButton,
  Card,
  useTheme,
  Snackbar
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { listPaymentMethods, addPaymentMethod as apiAdd, removePaymentMethod as apiRemove, setDefaultPaymentMethod } from '../../lib/settings/api';
import type { PaymentMethod as StoredMethod } from '../../lib/settings/types';

type PaymentMethod = 'card' | 'mpesa';

export default function PaymentDetailsScreen() {
  const theme = useTheme();
  const router = useRouter();
  
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState<{ visible: boolean; msg: string }>({ visible: false, msg: '' });
  const [methods, setMethods] = useState<StoredMethod[]>([]);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  useEffect(() => { (async () => { const { methods, defaultId } = await listPaymentMethods(); setMethods(methods); setDefaultId(defaultId); })(); }, []);
  
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
      if (paymentMethod === 'card') {
        const digits = cardDetails.cardNumber.replace(/\D/g, '');
        if (digits.length < 12) throw new Error('Invalid card number');
        const last4 = digits.slice(-4);
        const brand = digits.startsWith('4') ? 'Visa' : digits.startsWith('5') ? 'Mastercard' : 'Card';
        await apiAdd({ id: Date.now().toString(), type: 'card', brand, last4 });
      } else {
        if (!mpesaDetails.phoneNumber.trim()) throw new Error('Phone required');
        await apiAdd({ id: Date.now().toString(), type: 'mpesa', mpesaPhone: mpesaDetails.phoneNumber.trim() });
      }
      const next = await listPaymentMethods();
      setMethods(next.methods);
      setDefaultId(next.defaultId);
      setSnack({ visible: true, msg: 'Payment method saved' });
    } catch (error) {
      console.error('Error saving payment details:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeMethod = async (id: string) => {
    await apiRemove(id);
    const next = await listPaymentMethods();
    setMethods(next.methods);
    setDefaultId(next.defaultId);
    setSnack({ visible: true, msg: 'Removed' });
  };

  const makeDefault = async (id: string) => {
    await setDefaultPaymentMethod(id);
    setDefaultId(id);
    setSnack({ visible: true, msg: 'Set as default' });
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
    const cleaned = text.replace(/\D/g, '');
    const formatted = cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
    return formatted.substring(0, 19);
  };

  const formatExpiryDate = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return cleaned.substring(0, 2) + '/' + cleaned.substring(2, 4);
    }
    return cleaned;
  };

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          iconColor={theme.colors.onSurface}
          onPress={handleBack}
        />
        <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>Payment Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Saved methods */}
        <View style={{ marginBottom: 12 }}>
          {methods.map(m => (
            <Card key={m.id} mode="outlined" style={{ marginBottom: 8 }}>
              <Card.Content>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ fontWeight: '700' }}>{m.type === 'card' ? `${m.brand} •••• ${m.last4}` : `M-Pesa ${m.mpesaPhone}`}</Text>
                    {defaultId === m.id && <Text style={{ color: theme.colors.onSurfaceVariant }}>Default</Text>}
                  </View>
                  <View style={{ flexDirection: 'row' }}>
                    {defaultId !== m.id && (
                      <Button onPress={() => makeDefault(m.id)}>Set default</Button>
                    )}
                    <IconButton icon="delete" onPress={() => removeMethod(m.id)} />
                  </View>
                </View>
              </Card.Content>
            </Card>
          ))}
        </View>
        {/* Payment Methods Button */}
        <View style={styles.methodsButtonContainer}>
          <Button
            mode="contained"
            style={[styles.methodsButton, { backgroundColor: theme.colors.surface }]}
            labelStyle={[styles.methodsButtonText, { color: theme.colors.onSurface }]}
            contentStyle={styles.methodsButtonContent}
          >
            Payment Methods
          </Button>
        </View>

        {/* Payment Method Selection */}
        <Card style={[styles.selectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline }]} mode="outlined">
          <Card.Content style={styles.selectionContent}>
            <RadioButton.Group
              onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
              value={paymentMethod}
            >
              <View style={styles.radioOption}>
                <View style={styles.radioRow}>
                  <RadioButton value="card" color={theme.colors.primary} />
                  <Text style={[styles.radioLabel, { color: theme.colors.onSurface }]}>Credit or debit card</Text>
                </View>
              </View>
              
              <View style={[styles.divider, { backgroundColor: theme.colors.outline }]} />
              
              <View style={styles.radioOption}>
                <View style={styles.radioRow}>
                  <RadioButton value="mpesa" color={theme.colors.primary} />
                  <Text style={[styles.radioLabel, { color: theme.colors.onSurface }]}>M-Pesa</Text>
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
                outlineColor={theme.colors.outline}
                activeOutlineColor={theme.colors.primary}
                textColor={theme.colors.onSurface}
                keyboardType="numeric"
                maxLength={19}
                right={<TextInput.Icon icon="lock" color={theme.colors.onSurfaceVariant} />}
              />

              <View style={styles.cardRow}>
                <TextInput
                  mode="outlined"
                  label="Expiry Date"
                  value={cardDetails.expiryDate}
                  onChangeText={(text) => updateCardDetails('expiryDate', formatExpiryDate(text))}
                  style={[styles.textInput, styles.halfWidth]}
                  outlineColor={theme.colors.outline}
                  activeOutlineColor={theme.colors.primary}
                  textColor={theme.colors.onSurface}
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
                  outlineColor={theme.colors.outline}
                  activeOutlineColor={theme.colors.primary}
                  textColor={theme.colors.onSurface}
                  keyboardType="numeric"
                  maxLength={4}
                  secureTextEntry
                  right={<TextInput.Icon icon="help-circle" color={theme.colors.onSurfaceVariant} />}
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
                outlineColor={theme.colors.outline}
                activeOutlineColor={theme.colors.primary}
                textColor={theme.colors.onSurface}
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
            style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
            labelStyle={[styles.saveButtonText, { color: theme.colors.onPrimary }]}
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
  methodsButtonContainer: {
    marginTop: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  methodsButton: {
    borderRadius: 25,
  },
  methodsButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  methodsButtonContent: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  selectionCard: {
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
    marginLeft: 8,
    fontWeight: '500',
  },
  divider: {
    height: 1,
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
    backgroundColor: 'transparent',
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