import React, { useMemo, useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import DateChip from '../components/ui/DateChip';
import ActionButton from '../components/ui/ActionButton';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function DateTimeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ serviceId?: string }>();
  const serviceId = params.serviceId ?? '1';
  const [date, setDate] = useState(new Date());
  const [slot, setSlot] = useState<string | null>(null);

  const slots = ['09:00', '10:30', '12:00', '14:30', '16:00'];

  const grid = useMemo(() => {
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [date]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Text variant="titleMedium" style={{ fontWeight: '800', marginBottom: 8 }}>Choose date</Text>
        {/* Calendar grid */}
        <View style={{ borderWidth: 1, borderColor: theme.colors.outline, borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 }}>
            <Pressable onPress={() => setDate(new Date(date.getFullYear(), date.getMonth() - 1, 1))}><Text>{'<'}</Text></Pressable>
            <Text style={{ fontWeight: '800' }}>{date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
            <Pressable onPress={() => setDate(new Date(date.getFullYear(), date.getMonth() + 1, 1))}><Text>{'>'}</Text></Pressable>
          </View>
          <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 6, gap: 8, justifyContent: 'space-between' }}>
            {['S','M','T','W','T','F','S'].map((d) => <Text key={d} style={{ width: 32, textAlign: 'center', fontWeight: '700' }}>{d}</Text>)}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
            {grid.map((cell, idx) => {
              const isSelected = cell !== null && new Date(date.getFullYear(), date.getMonth(), cell).toDateString() === date.toDateString();
              return (
                <Pressable key={idx} disabled={cell === null} onPress={() => cell && setDate(new Date(date.getFullYear(), date.getMonth(), cell))}>
                  <View style={{ width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: isSelected ? theme.colors.primary : 'transparent' }}>
                    <Text style={{ color: isSelected ? theme.colors.onPrimary : theme.colors.onSurfaceVariant }}>{cell ?? ''}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text variant="titleMedium" style={{ fontWeight: '800', marginBottom: 8 }}>Choose time</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {slots.map((s) => (
            <DateChip key={s} label={s} selected={slot === s} onPress={() => setSlot(s)} />
          ))}
        </View>

        <ActionButton style={{ marginTop: 16 }} onPress={() => router.push({ pathname: '/booking/payment', params: { serviceId, date: date.toISOString(), slot } } as any)} disabled={!slot}>
          Continue
        </ActionButton>
      </View>
    </ScrollView>
  );
}


