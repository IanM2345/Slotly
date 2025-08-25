import React, { useEffect, useState } from 'react';
import { View, ScrollView, Image } from 'react-native';
import { Text, Card, useTheme, ActivityIndicator, Divider } from 'react-native-paper';
import ActionButton from '../components/ui/ActionButton';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getServiceById } from '../../lib/api/modules/business'; // You might need to create this

interface ServiceDetails {
  id: string;
  name: string;
  description?: string;
  price?: number;
  duration?: number;
  imageUrl?: string;
  business: {
    id: string;
    name: string;
    address?: string;
    phone?: string;
    email?: string;
  };
}

export default function ServiceScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    serviceId?: string;
    businessId?: string;
    serviceName?: string;
    servicePrice?: string;
    businessName?: string;
  }>();

  const [service, setService] = useState<ServiceDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadServiceDetails();
  }, []);

  const loadServiceDetails = async () => {
    try {
      setLoading(true);
      
      // If we have all the data from params, use it
      if (params.serviceId && params.businessId && params.serviceName && params.businessName) {
        setService({
          id: params.serviceId,
          name: params.serviceName,
          price: params.servicePrice ? parseInt(params.servicePrice) : undefined,
          business: {
            id: params.businessId,
            name: params.businessName,
          },
        });
        setLoading(false);
        return;
      }

      // Otherwise, try to fetch from API
      if (params.serviceId) {
        // You might need to implement this API call
        // const serviceData = await getServiceById(params.serviceId);
        // setService(serviceData);
        
        // For now, create a mock service with proper IDs
        setService({
          id: params.serviceId,
          name: params.serviceName || 'Service',
          price: params.servicePrice ? parseInt(params.servicePrice) : undefined,
          business: {
            id: params.businessId || `biz-${Date.now()}`, // Generate a business ID if missing
            name: params.businessName || 'Business',
          },
        });
      }
    } catch (error) {
      console.error('Error loading service:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBookService = () => {
    if (!service) return;

    console.log('Service screen navigation params:', {
      serviceId: service.id,
      businessId: service.business.id,
      serviceName: service.name,
      servicePrice: service.price ? String(service.price) : undefined,
      businessName: service.business.name,
    });

    router.push({
      pathname: '/booking/date-time',
      params: {
        serviceId: service.id,
        businessId: service.business.id,
        serviceName: service.name,
        servicePrice: service.price ? String(service.price) : undefined,
        businessName: service.business.name,
      },
    } as any);
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
          Loading service details...
        </Text>
      </View>
    );
  }

  if (!service) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: theme.colors.background,
        paddingHorizontal: 16,
      }}>
        <Text variant="headlineSmall" style={{ textAlign: 'center', marginBottom: 8 }}>
          Service Not Found
        </Text>
        <Text style={{ textAlign: 'center', color: theme.colors.onSurfaceVariant }}>
          We couldn't load the service details. Please try again.
        </Text>
        <ActionButton 
          style={{ marginTop: 16 }} 
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
      {/* Service Image */}
      <Image
        source={{ 
          uri: service.imageUrl || 'https://via.placeholder.com/400x200.png?text=Service+Image' 
        }}
        style={{ width: '100%', height: 200 }}
      />

      <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
        {/* Service Info */}
        <Text variant="headlineSmall" style={{ fontWeight: '700', marginBottom: 8 }}>
          {service.name}
        </Text>

        <Text variant="bodyMedium" style={{ 
          color: theme.colors.onSurfaceVariant,
          marginBottom: 16,
        }}>
          {service.description || 'Professional service available for booking.'}
        </Text>

        {/* Price & Duration */}
        <Card style={{ marginBottom: 20 }}>
          <View style={{ padding: 16 }}>
            <Text variant="titleMedium" style={{ fontWeight: '600', marginBottom: 12 }}>
              Service Details
            </Text>
            
            {service.price && (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text>Price</Text>
                  <Text style={{ fontWeight: '600', color: theme.colors.primary }}>
                    KSh {service.price.toLocaleString()}
                  </Text>
                </View>
                <Divider style={{ marginVertical: 8 }} />
              </>
            )}
            
            {service.duration && (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text>Duration</Text>
                  <Text style={{ fontWeight: '600' }}>
                    {service.duration} minutes
                  </Text>
                </View>
                <Divider style={{ marginVertical: 8 }} />
              </>
            )}
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text>Business</Text>
              <Text style={{ fontWeight: '600' }}>
                {service.business.name}
              </Text>
            </View>
          </View>
        </Card>

        {/* Business Info */}
        <Card style={{ marginBottom: 24 }}>
          <View style={{ padding: 16 }}>
            <Text variant="titleMedium" style={{ fontWeight: '600', marginBottom: 12 }}>
              Business Information
            </Text>
            
            <Text variant="bodyMedium" style={{ fontWeight: '600', marginBottom: 4 }}>
              {service.business.name}
            </Text>
            
            {service.business.address && (
              <Text variant="bodyMedium" style={{ 
                color: theme.colors.onSurfaceVariant,
                marginBottom: 8,
              }}>
                {service.business.address}
              </Text>
            )}
            
            {service.business.phone && (
              <Text variant="bodyMedium" style={{ 
                color: theme.colors.onSurfaceVariant,
                marginBottom: 4,
              }}>
                Phone: {service.business.phone}
              </Text>
            )}
            
            {service.business.email && (
              <Text variant="bodyMedium" style={{ 
                color: theme.colors.onSurfaceVariant,
              }}>
                Email: {service.business.email}
              </Text>
            )}
          </View>
        </Card>

        {/* Book Button */}
        <ActionButton onPress={handleBookService}>
          Book This Service
        </ActionButton>

        {/* Debug Info */}
        {__DEV__ && (
          <View style={{ 
            marginTop: 16, 
            padding: 12, 
            backgroundColor: theme.colors.surfaceVariant,
            borderRadius: 8,
          }}>
            <Text variant="bodySmall" style={{ fontWeight: '600', marginBottom: 8 }}>
              Debug Info:
            </Text>
            <Text variant="bodySmall">Service ID: {service.id}</Text>
            <Text variant="bodySmall">Business ID: {service.business.id}</Text>
            <Text variant="bodySmall">Original Params: {JSON.stringify(params, null, 2)}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}