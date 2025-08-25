import React, { useState, useMemo } from 'react';
import { View, ScrollView } from 'react-native';
import { Text, useTheme, Card, TouchableRipple } from 'react-native-paper';
import { Calendar, DateData } from 'react-native-calendars';
import ActionButton from '../components/ui/ActionButton';
import { useLocalSearchParams, useRouter } from 'expo-router';

interface TimeSlot {
  id: string;
  time: string;
  available: boolean;
  datetime: Date;
}

export default function DateTimeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    serviceId?: string;
    businessId?: string;
    serviceName?: string;
    servicePrice?: string;
    businessName?: string;
  }>();

  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  // Generate time slots for the selected date
  const timeSlots = useMemo((): TimeSlot[] => {
    if (!selectedDate) return [];

    const slots: TimeSlot[] = [];
    const baseDate = new Date(selectedDate);
    
    // Generate slots from 9 AM to 5 PM
    for (let hour = 9; hour <= 17; hour++) {
      for (let minute of [0, 30]) {
        const datetime = new Date(baseDate);
        datetime.setHours(hour, minute, 0, 0);
        
        // Skip past time slots
        const now = new Date();
        const isAvailable = datetime > now;
        
        // Format time display
        const timeStr = datetime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });

        slots.push({
          id: `${hour}-${minute}`,
          time: timeStr,
          available: isAvailable,
          datetime,
        });
      }
    }

    return slots;
  }, [selectedDate]);

  const handleDateSelect = (day: DateData) => {
    setSelectedDate(day.dateString);
    setSelectedSlot(null); // Reset slot selection when date changes
  };

  const handleSlotSelect = (slot: TimeSlot) => {
    if (slot.available) {
      setSelectedSlot(slot);
    }
  };

  const handleContinue = () => {
    if (!selectedSlot) return;

    // Debug logging
    console.log('DateTime params before navigation:', params);
    console.log('Selected slot:', selectedSlot);

    // Calculate end time (assuming 60 minutes duration - you might want to get this from service data)
    const startTime = selectedSlot.datetime;
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // Add 60 minutes

    const navParams = {
      ...params, // Spread existing params to preserve businessId
      date: selectedDate,
      slot: selectedSlot.time,
      startTimeISO: startTime.toISOString(),
      endTimeISO: endTime.toISOString(),
    };

    console.log('Navigation params:', navParams);

    router.push({
      pathname: '/booking/payment',
      params: navParams,
    } as any);
  };

  // Calendar theme
  const calendarTheme = {
    backgroundColor: theme.colors.surface,
    calendarBackground: theme.colors.surface,
    textSectionTitleColor: theme.colors.onSurface,
    selectedDayBackgroundColor: theme.colors.primary,
    selectedDayTextColor: theme.colors.onPrimary,
    todayTextColor: theme.colors.primary,
    dayTextColor: theme.colors.onSurface,
    textDisabledColor: theme.colors.onSurfaceDisabled,
    arrowColor: theme.colors.primary,
    monthTextColor: theme.colors.onSurface,
    textDayFontWeight: '500' as const,
    textMonthFontWeight: '600' as const,
    textDayHeaderFontWeight: '600' as const,
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <ScrollView 
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingBottom: 24 }}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        {/* Service Info */}
        <View style={{ marginBottom: 24 }}>
          <Text variant="titleMedium" style={{ fontWeight: '800' }}>
            {params.serviceName || 'Service'}
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {params.businessName || 'Business'}
          </Text>
          {params.servicePrice && (
            <Text variant="bodyMedium" style={{ color: theme.colors.primary, fontWeight: '600' }}>
              KSh {parseInt(params.servicePrice).toLocaleString()}
            </Text>
          )}
        </View>

        {/* Calendar */}
        <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: 12 }}>
          Select Date
        </Text>
        <Card style={{ marginBottom: 24 }}>
          <Calendar
            onDayPress={handleDateSelect}
            markedDates={{
              [selectedDate]: {
                selected: true,
                selectedColor: theme.colors.primary,
              },
            }}
            theme={calendarTheme}
            minDate={today}
            firstDay={1} // Monday
          />
        </Card>

        {/* Time Slots */}
        {selectedDate && (
          <>
            <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: 12 }}>
              Available Times
            </Text>
            <View style={{ 
              flexDirection: 'row', 
              flexWrap: 'wrap', 
              gap: 8, 
              marginBottom: 24 
            }}>
              {timeSlots.map((slot) => (
                <Card
                  key={slot.id}
                  style={{
                    opacity: slot.available ? 1 : 0.5,
                    backgroundColor: selectedSlot?.id === slot.id 
                      ? theme.colors.primaryContainer 
                      : theme.colors.surface,
                  }}
                >
                  <TouchableRipple
                    onPress={() => handleSlotSelect(slot)}
                    disabled={!slot.available}
                    style={{ 
                      paddingHorizontal: 16, 
                      paddingVertical: 12,
                      minWidth: 80,
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: selectedSlot?.id === slot.id
                          ? theme.colors.onPrimaryContainer
                          : slot.available
                          ? theme.colors.onSurface
                          : theme.colors.onSurfaceDisabled,
                        fontWeight: selectedSlot?.id === slot.id ? '600' : '500',
                      }}
                    >
                      {slot.time}
                    </Text>
                  </TouchableRipple>
                </Card>
              ))}
            </View>

            {timeSlots.length === 0 && (
              <Text style={{ 
                textAlign: 'center', 
                color: theme.colors.onSurfaceVariant,
                marginBottom: 24 
              }}>
                No available time slots for this date
              </Text>
            )}
          </>
        )}

        {/* Selected Summary */}
        {selectedDate && selectedSlot && (
          <Card style={{ marginBottom: 24, backgroundColor: theme.colors.secondaryContainer }}>
            <View style={{ padding: 16 }}>
              <Text variant="titleSmall" style={{ fontWeight: '600', marginBottom: 4 }}>
                Selected Appointment
              </Text>
              <Text style={{ color: theme.colors.onSecondaryContainer }}>
                {new Date(selectedDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })} at {selectedSlot.time}
              </Text>
            </View>
          </Card>
        )}

        {/* Continue Button */}
        <ActionButton
          onPress={handleContinue}
          disabled={!selectedDate || !selectedSlot}
          style={{ marginTop: 8 }}
        >
          Continue to Payment
        </ActionButton>

        {/* Debug info (remove in production) */}
        {__DEV__ && selectedSlot && (
          <View style={{ 
            marginTop: 16, 
            padding: 8, 
            backgroundColor: theme.colors.surfaceVariant 
          }}>
            <Text variant="bodySmall">Debug Info:</Text>
            <Text variant="bodySmall">
              ISO Start: {selectedSlot.datetime.toISOString()}
            </Text>
            <Text variant="bodySmall">
              ISO End: {new Date(selectedSlot.datetime.getTime() + 60 * 60 * 1000).toISOString()}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}