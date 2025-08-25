import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, ScrollView, Alert } from 'react-native';
import { Text, RadioButton, TextInput, useTheme, Divider } from 'react-native-paper';
import ActionButton from '../components/ui/ActionButton';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSession } from '../../context/SessionContext';
import { createBooking } from '../../lib/api/modules/users';
import { getServiceById } from '../../lib/api/modules/business';

type Method = 'card' | 'mpesa' | 'in_person';

type ServiceSummary = {
  id: string;
  name: string;
  description?: string | null;
  duration?: number | null;
  price?: number | null;
  imageUrl?: string | null;
  business?: { 
    id: string; 
    name: string; 
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    logoUrl?: string | null;
  };
  _meta?: {
    originalRequestId: string;
    wasSynthetic: boolean;
    resolvedFromBusinessId?: string | null;
  };
};

export default function PaymentScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { token } = useSession();
  const { serviceId, businessId, startTimeISO, endTimeISO, serviceName } =
    useLocalSearchParams<{
      serviceId?: string;
      businessId?: string;
      startTimeISO?: string;
      endTimeISO?: string;
      serviceName?: string;
    }>();

  const [summary, setSummary] = useState<ServiceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [method, setMethod] = useState<Method>('in_person');
  const [card, setCard] = useState({ number: '', exp: '', cvc: '' });
  const [mpesa, setMpesa] = useState({ phone: '' });

  const loadServiceDetails = useCallback(async () => {
    if (!serviceId) {
      setError('No service ID provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('Loading service details for ID:', serviceId);
      
      // Call getServiceById - it now handles both real and synthetic IDs
      const serviceData = await getServiceById(String(serviceId));
      
      console.log('Service data received:', serviceData);
      
      if (!serviceData) {
        throw new Error('No service data returned');
      }

      // Handle different response formats
      const service = serviceData.service || serviceData;
      
      if (!service.id) {
        throw new Error('Invalid service data - missing ID');
      }

      setSummary(service);
      
      // Log resolution details for debugging
      if (service._meta?.wasSynthetic) {
        console.log(`✅ Resolved synthetic ID "${service._meta.originalRequestId}" to real service ID "${service.id}"`);
      }
      
    } catch (e: any) {
      console.error('Failed to load service details:', e);
      const errorMsg = e?.response?.data?.error || 
                      e?.message || 
                      'Failed to load service details';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    loadServiceDetails();
  }, [loadServiceDetails]);

  const dateTimeInfo = useMemo(() => {
    if (!startTimeISO) return { date: '—', time: '—', isValid: false };
    
    try {
      const d = new Date(String(startTimeISO));
      if (isNaN(d.getTime())) return { date: '—', time: '—', isValid: false };
      
      const date = d.toLocaleDateString(undefined, { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
      const time = d.toLocaleTimeString(undefined, { 
        hour: 'numeric', 
        minute: '2-digit' 
      });
      return { date, time, isValid: true };
    } catch {
      return { date: '—', time: '—', isValid: false };
    }
  }, [startTimeISO]);

  const validateBookingData = () => {
    if (!summary?.id) return 'Service not loaded';
    if (!summary?.business?.id) return 'Business information missing';
    if (!startTimeISO) return 'Start time not provided';
    if (!dateTimeInfo.isValid) return 'Invalid start time';
    if (!token) return 'Authentication required';
    return null;
  };

  const validatePaymentMethod = () => {
    if (method === 'card') {
      if (!card.number.trim() || !card.exp.trim() || !card.cvc.trim()) {
        return 'Please fill in all card details';
      }
    } else if (method === 'mpesa') {
      if (!mpesa.phone.trim()) {
        return 'Please enter your M-Pesa phone number';
      }
    }
    return null;
  };

  const handlePayAndBook = async () => {
    // Validate booking data
    const bookingError = validateBookingData();
    if (bookingError) {
      Alert.alert('Booking Error', bookingError);
      return;
    }

    // Validate payment method
    const paymentError = validatePaymentMethod();
    if (paymentError) {
      Alert.alert('Payment Error', paymentError);
      return;
    }

    try {
      setSubmitting(true);

      // TODO: Process payment here (skip for in-person)
      if (method !== 'in_person') {
        // Simulate payment processing
        console.log('Processing payment...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Calculate end time if not provided
      let finalEndTime = endTimeISO;
      if (!finalEndTime && startTimeISO) {
        const startDate = new Date(startTimeISO);
        const durationMinutes = summary!.duration || 60;
        const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
        finalEndTime = endDate.toISOString();
      }

      console.log('Creating booking with data:', {
        serviceId: summary!.id,
        businessId: summary!.business!.id,
        startTime: startTimeISO,
        endTime: finalEndTime,
        // FYI: pay at venue = method === 'in_person'
      });

      // Create booking with the REAL service ID (resolved from synthetic if needed)
      const booking = await createBooking(
        {
          serviceId: String(summary!.id), // ✅ Always the real service ID
          businessId: String(summary!.business!.id),
          startTime: String(startTimeISO),
          endTime: finalEndTime ? String(finalEndTime) : undefined,
          status: 'CONFIRMED',
          // ✅ Removed paymentMethod and mpesaPhone - not part of Booking model
        },
        token!
      );

      console.log('✅ Booking created successfully:', booking);

      router.push({
        pathname: '/booking/confirmation',
        params: { bookingId: booking.id }
      } as any);

    } catch (error: any) {
      console.error('❌ Booking creation failed:', error);
      
      // Extract error message from various possible formats
      const errorMessage = error?.response?.data?.message || 
                          error?.response?.data?.error ||
                          error?.message || 
                          'Failed to create booking. Please try again.';
      
      Alert.alert('Booking Failed', errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <View style={{ 
        flex: 1, 
        backgroundColor: theme.colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
      }}>
        <Text variant="bodyLarge" style={{ marginBottom: 8 }}>
          Loading service details...
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          Service ID: {serviceId}
        </Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={{ 
        flex: 1, 
        backgroundColor: theme.colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
      }}>
        <Text variant="headlineSmall" style={{ 
          color: theme.colors.error,
          marginBottom: 16,
          textAlign: 'center',
        }}>
          Service Not Found
        </Text>
        <Text variant="bodyMedium" style={{ 
          color: theme.colors.onSurfaceVariant,
          textAlign: 'center',
          marginBottom: 8,
        }}>
          {error}
        </Text>
        <Text variant="bodySmall" style={{ 
          color: theme.colors.onSurfaceVariant,
          textAlign: 'center',
          marginBottom: 24,
        }}>
          Service ID: {serviceId}
        </Text>
        <ActionButton 
          mode="outlined"
          onPress={() => router.back()}
        >
          Go Back
        </ActionButton>
      </View>
    );
  }

  return (
    <ScrollView 
      style={{ flex: 1, backgroundColor: theme.colors.background }} 
      contentContainerStyle={{ paddingBottom: 24 }}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        {/* Payment Method Selection */}
        <Text variant="titleMedium" style={{ fontWeight: '800', marginBottom: 8 }}>
          Payment Method
        </Text>
        
        <RadioButton.Group onValueChange={(v) => setMethod(v as Method)} value={method}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 6 }}>
            <RadioButton value="in_person" />
            <Text>Pay in Person</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 6, opacity: 0.5 }}>
            <RadioButton value="card" disabled />
            <Text>Credit/Debit Card (Coming Soon)</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 6, opacity: 0.5 }}>
            <RadioButton value="mpesa" disabled />
            <Text>M-Pesa (Coming Soon)</Text>
          </View>
        </RadioButton.Group>

        {method !== 'in_person' && (
          <View style={{ 
            marginTop: 12, 
            padding: 12, 
            backgroundColor: theme.colors.secondaryContainer,
            borderRadius: 8,
          }}>
            <Text style={{ 
              color: theme.colors.onSecondaryContainer,
              fontSize: 14,
              textAlign: 'center',
            }}>
              Online payments coming soon! For now, you can pay directly at the business.
            </Text>
          </View>
        )}

        {/* Booking Summary */}
        <View style={{ marginVertical: 16 }}>
          <Text variant="titleMedium" style={{ fontWeight: '800', marginBottom: 8 }}>
            Booking Summary
          </Text>
          
          <View style={{ gap: 4 }}>
            <Text>
              <Text style={{ fontWeight: '600' }}>Service: </Text>
              {summary?.name ?? '—'}
            </Text>
            
            <Text>
              <Text style={{ fontWeight: '600' }}>Business: </Text>
              {summary?.business?.name ?? '—'}
            </Text>
            
            {summary?.business?.address && (
              <Text>
                <Text style={{ fontWeight: '600' }}>Location: </Text>
                {summary.business.address}
              </Text>
            )}
            
            <Text>
              <Text style={{ fontWeight: '600' }}>Date: </Text>
              {dateTimeInfo.date}
            </Text>
            
            <Text>
              <Text style={{ fontWeight: '600' }}>Time: </Text>
              {dateTimeInfo.time}
            </Text>
            
            {summary?.duration && (
              <Text>
                <Text style={{ fontWeight: '600' }}>Duration: </Text>
                {summary.duration} minutes
              </Text>
            )}
            
            {summary?.price && (
              <Text>
                <Text style={{ fontWeight: '600' }}>Price: </Text>
                KSh {summary.price.toLocaleString()}
              </Text>
            )}
          </View>
          
          <Divider style={{ marginTop: 12 }} />
        </View>

        {/* Payment Form */}
        {method === 'in_person' ? (
          <View style={{ 
            marginTop: 16, 
            padding: 16, 
            backgroundColor: theme.colors.primaryContainer,
            borderRadius: 12,
          }}>
            <Text variant="titleSmall" style={{ 
              fontWeight: '600', 
              color: theme.colors.onPrimaryContainer,
              marginBottom: 8,
            }}>
              Pay in Person
            </Text>
            <Text style={{ 
              color: theme.colors.onPrimaryContainer,
              lineHeight: 20,
            }}>
              • Your appointment is confirmed{'\n'}
              • Pay directly at the business when you arrive{'\n'}
              • Please bring cash or card for payment{'\n'}
              • Arrive 5-10 minutes early
            </Text>
          </View>
        ) : method === 'card' ? (
          <View style={{ marginTop: 12, gap: 12 }}>
            <TextInput 
              mode="outlined" 
              label="Card number" 
              value={card.number} 
              onChangeText={(t) => setCard({ ...card, number: t })}
              keyboardType="numeric"
              placeholder="1234 5678 9012 3456"
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TextInput 
                style={{ flex: 1 }} 
                mode="outlined" 
                label="MM/YY" 
                value={card.exp} 
                onChangeText={(t) => setCard({ ...card, exp: t })}
                keyboardType="numeric"
                placeholder="12/25"
              />
              <TextInput 
                style={{ flex: 1 }} 
                mode="outlined" 
                label="CVC" 
                value={card.cvc} 
                onChangeText={(t) => setCard({ ...card, cvc: t })}
                keyboardType="numeric"
                placeholder="123"
                secureTextEntry
              />
            </View>
          </View>
        ) : (
          <View style={{ marginTop: 12 }}>
            <TextInput 
              mode="outlined" 
              label="M-Pesa Phone Number" 
              value={mpesa.phone} 
              onChangeText={(t) => setMpesa({ phone: t })}
              keyboardType="phone-pad"
              placeholder="+254 7XX XXX XXX"
            />
            <Text style={{ 
              marginTop: 8, 
              fontSize: 12, 
              color: theme.colors.onSurfaceVariant 
            }}>
              You will receive an M-Pesa prompt to complete payment
            </Text>
          </View>
        )}

        {/* Action Button */}
        <ActionButton 
          style={{ marginTop: 24 }} 
          onPress={handlePayAndBook}
          loading={submitting}
          disabled={submitting || !summary?.id || !dateTimeInfo.isValid}
        >
          {submitting 
            ? 'Creating Booking...' 
            : method === 'in_person' 
              ? 'Confirm Booking' 
              : 'Pay & Book'
          }
        </ActionButton>

        {/* Debug Info (Development Only) */}
        {__DEV__ && summary && (
          <View style={{ 
            marginTop: 16, 
            padding: 12, 
            backgroundColor: theme.colors.surfaceVariant,
            borderRadius: 8,
          }}>
            <Text variant="bodySmall" style={{ fontWeight: '600', marginBottom: 4 }}>
              Debug Information
            </Text>
            <Text variant="bodySmall">
              Original Service ID: {serviceId}
            </Text>
            <Text variant="bodySmall">
              Resolved Service ID: {summary.id}
            </Text>
            <Text variant="bodySmall">
              Business ID: {summary.business?.id}
            </Text>
            <Text variant="bodySmall">
              Was Synthetic: {summary._meta?.wasSynthetic ? 'Yes' : 'No'}
            </Text>
            {summary._meta?.resolvedFromBusinessId && (
              <Text variant="bodySmall">
                Resolved From Business: {summary._meta.resolvedFromBusinessId}
              </Text>
            )}
            <Text variant="bodySmall">
              Start Time Valid: {dateTimeInfo.isValid ? 'Yes' : 'No'}
            </Text>
            <Text variant="bodySmall">
              Payment Method: {method}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}