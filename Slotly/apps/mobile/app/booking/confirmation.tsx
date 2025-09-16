import React, { useEffect, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { Text, Card, useTheme, Divider, ActivityIndicator } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import ActionButton from '../components/ui/ActionButton';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSession } from '../../context/SessionContext';
import { listBookings } from '../../lib/api/modules/users';

interface BookingDetails {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  service: {
    id: string;
    name: string;
    price?: number;
    duration?: number;
  };
  business: {
    id: string;
    name: string;
    address?: string;
  };
}

export default function ConfirmationScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { token } = useSession();
  const params = useLocalSearchParams<{
    bookingId?: string;
    serviceId?: string;
    businessId?: string;
    date?: string;
    slot?: string;
    serviceName?: string;
    servicePrice?: string;
    businessName?: string;
    paymentMethod?: string;
  }>();

  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(!!params.bookingId);

  // Fetch booking details if bookingId is provided
  useEffect(() => {
    if (params.bookingId && token) {
      fetchBookingDetails();
    }
  }, [params.bookingId, token]);

  const fetchBookingDetails = async () => {
    if (!params.bookingId || !token) return;

    try {
      setLoading(true);
      const response = await listBookings(token);
      
      // Find the booking in upcoming or past bookings
      const allBookings = [
        ...(response.upcomingBookings || []),
        ...(response.pastBookings || []),
      ];
      
      const foundBooking = allBookings.find(b => b.id === params.bookingId);
      
      if (foundBooking) {
        setBooking(foundBooking);
      }
    } catch (error) {
      console.error('Failed to fetch booking details:', error);
    } finally {
      setLoading(false);
    }
  };

  // Use either fetched booking data or params
  const displayData = booking ? {
    serviceName: booking.service.name,
    servicePrice: booking.service.price,
    businessName: booking.business.name,
    businessAddress: booking.business.address,
    startTime: new Date(booking.startTime),
    endTime: new Date(booking.endTime),
    status: booking.status,
    bookingId: booking.id,
  } : {
    serviceName: params.serviceName || 'Service',
    servicePrice: params.servicePrice ? parseInt(params.servicePrice) : null,
    businessName: params.businessName || 'Business',
    businessAddress: undefined,
    startTime: params.date ? new Date(params.date) : new Date(),
    endTime: params.date ? new Date(params.date) : new Date(),
    status: 'CONFIRMED',
    bookingId: params.bookingId || 'pending',
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }) + ' at ' + date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (loading) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: theme.colors.background 
      }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 16, color: theme.colors.onSurfaceVariant }}>
          Loading booking details...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingBottom: 24 }}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 32 }}>
        {/* Success Header */}
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <View style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: theme.colors.primaryContainer,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 16,
          }}>
            <Ionicons 
              name="checkmark-circle" 
              size={48} 
              color={theme.colors.primary} 
            />
          </View>
          <Text variant="headlineSmall" style={{ 
            fontWeight: '700', 
            textAlign: 'center',
            marginBottom: 8,
          }}>
            Booking Confirmed!
          </Text>
          <Text variant="bodyMedium" style={{ 
            textAlign: 'center',
            color: theme.colors.onSurfaceVariant 
          }}>
            Your appointment has been successfully booked
          </Text>
        </View>

        {/* Booking Details Card */}
        <Card style={{ marginBottom: 24 }}>
          <View style={{ padding: 20 }}>
            <Text variant="titleMedium" style={{ 
              fontWeight: '700', 
              marginBottom: 16,
              color: theme.colors.primary 
            }}>
              Booking Details
            </Text>

            <View style={{ gap: 12 }}>
              <View>
                <Text variant="bodySmall" style={{ 
                  color: theme.colors.onSurfaceVariant,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: 4,
                }}>
                  Service
                </Text>
                <Text variant="bodyLarge" style={{ fontWeight: '600' }}>
                  {displayData.serviceName}
                </Text>
              </View>

              <Divider />

              <View>
                <Text variant="bodySmall" style={{ 
                  color: theme.colors.onSurfaceVariant,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: 4,
                }}>
                  Business
                </Text>
                <Text variant="bodyLarge" style={{ fontWeight: '600' }}>
                  {displayData.businessName}
                </Text>
                {displayData.businessAddress && (
                  <Text variant="bodyMedium" style={{ 
                    color: theme.colors.onSurfaceVariant,
                    marginTop: 2,
                  }}>
                    {displayData.businessAddress}
                  </Text>
                )}
              </View>

              <Divider />

              <View>
                <Text variant="bodySmall" style={{ 
                  color: theme.colors.onSurfaceVariant,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: 4,
                }}>
                  Date & Time
                </Text>
                <Text variant="bodyLarge" style={{ fontWeight: '600' }}>
                  {formatDateTime(displayData.startTime)}
                </Text>
              </View>

              {displayData.servicePrice && (
                <>
                  <Divider />
                  <View>
                    <Text variant="bodySmall" style={{ 
                      color: theme.colors.onSurfaceVariant,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      marginBottom: 4,
                    }}>
                      Price
                    </Text>
                    <Text variant="bodyLarge" style={{ 
                      fontWeight: '600',
                      color: theme.colors.primary,
                    }}>
                      KSh {displayData.servicePrice.toLocaleString()}
                    </Text>
                  </View>
                </>
              )}

              <Divider />

              <View>
                <Text variant="bodySmall" style={{ 
                  color: theme.colors.onSurfaceVariant,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: 4,
                }}>
                  Booking ID
                </Text>
                <Text variant="bodyLarge" style={{ fontWeight: '600' }}>
                  #{displayData.bookingId}
                </Text>
              </View>

              <Divider />

              <View>
                <Text variant="bodySmall" style={{ 
                  color: theme.colors.onSurfaceVariant,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: 4,
                }}>
                  Status
                </Text>
                <View style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  backgroundColor: theme.colors.primaryContainer,
                  borderRadius: 12,
                  alignSelf: 'flex-start',
                }}>
                  <Text variant="bodySmall" style={{ 
                    color: theme.colors.onPrimaryContainer,
                    fontWeight: '600',
                  }}>
                    {displayData.status}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </Card>

        {/* Payment Method (if provided) */}
        {params.paymentMethod && (
          <Card style={{ marginBottom: 24 }}>
            <View style={{ padding: 20 }}>
              <Text variant="titleMedium" style={{ 
                fontWeight: '700', 
                marginBottom: 12,
              }}>
                Payment Method
              </Text>
              <Text variant="bodyLarge" style={{ textTransform: 'capitalize' }}>
                {params.paymentMethod === 'mpesa' ? 'M-Pesa' : 'Credit/Debit Card'}
              </Text>
            </View>
          </Card>
        )}

        {/* Info Card */}
        <Card style={{ 
          marginBottom: 24,
          backgroundColor: theme.colors.secondaryContainer,
        }}>
          <View style={{ padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <Ionicons 
                name="information-circle" 
                size={24} 
                color={theme.colors.onSecondaryContainer}
                style={{ marginTop: 2 }}
              />
              <View style={{ flex: 1 }}>
                <Text variant="titleSmall" style={{ 
                  fontWeight: '600',
                  color: theme.colors.onSecondaryContainer,
                  marginBottom: 4,
                }}>
                  Important Information
                </Text>
                <Text variant="bodyMedium" style={{ 
                  color: theme.colors.onSecondaryContainer,
                  lineHeight: 20,
                }}>
                  • Please arrive 5-10 minutes early for your appointment{'\n'}
                  • You can reschedule or cancel up to 2 hours before your appointment{'\n'}
                  • A confirmation SMS will be sent to your registered number
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Action Buttons */}
        <View style={{ gap: 12 }}>
  <ActionButton
    onPress={() => router.replace('/(tabs)/history' as any)}
    style={{ backgroundColor: theme.colors.primary }}
  >
    View My Bookings
  </ActionButton>

  <ActionButton
    mode="outlined"
    onPress={() => router.push('/(tabs)/explore' as any)}
    style={{ borderColor: theme.colors.outline }}
  >
    Book Another Service
  </ActionButton>
</View>

        {/* Contact Support */}
        <View style={{ marginTop: 24, alignItems: 'center' }}>
          <Text variant="bodyMedium" style={{ 
            color: theme.colors.onSurfaceVariant,
            textAlign: 'center',
            marginBottom: 8,
          }}>
            Need help with your booking?
          </Text>
          <ActionButton
            mode="text"
            onPress={() => {
              // Navigate to support or open contact options
              router.push('/support' as any);
            }}
            compact
          >
            Contact Support
          </ActionButton>
        </View>

        {/* Debug info (remove in production) */}
        {__DEV__ && (
          <View style={{ 
            marginTop: 24, 
            padding: 12, 
            backgroundColor: theme.colors.surfaceVariant,
            borderRadius: 8,
          }}>
            <Text variant="bodySmall" style={{ fontWeight: '600', marginBottom: 8 }}>
              Debug Info:
            </Text>
            <Text variant="bodySmall">Booking ID: {params.bookingId || 'N/A'}</Text>
            <Text variant="bodySmall">Service ID: {params.serviceId || 'N/A'}</Text>
            <Text variant="bodySmall">Business ID: {params.businessId || 'N/A'}</Text>
            <Text variant="bodySmall">Fetched from API: {booking ? 'Yes' : 'No'}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}