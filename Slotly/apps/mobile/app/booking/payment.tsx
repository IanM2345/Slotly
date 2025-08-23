import React, { useMemo, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { Text, RadioButton, TextInput, useTheme, Divider } from 'react-native-paper';
import ActionButton from '../components/ui/ActionButton';
import { useLocalSearchParams, useRouter } from 'expo-router';

type Method = 'card' | 'mpesa';

export default function PaymentScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ serviceId?: string; date?: string; slot?: string }>();
  const serviceId = params.serviceId ?? '1';
  const dateLabel = useMemo(() => (params.date ? new Date(params.date).toLocaleString() : '—'), [params.date]);
  const slotLabel = params.slot ?? '—';
  const [method, setMethod] = useState<Method>('card');
  const [card, setCard] = useState({ number: '', exp: '', cvc: '' });
  const [mpesa, setMpesa] = useState({ phone: '' });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Text variant="titleMedium" style={{ fontWeight: '800', marginBottom: 8 }}>Payment Method</Text>
        <RadioButton.Group onValueChange={(v) => setMethod(v as Method)} value={method}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 6 }}>
            <RadioButton value="card" />
            <Text>Credit/Debit Card</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 6 }}>
            <RadioButton value="mpesa" />
            <Text>M-Pesa</Text>
          </View>
        </RadioButton.Group>

        {/* Summary */}
        <View style={{ marginBottom: 12 }}>
          <Text variant="titleMedium" style={{ fontWeight: '800', marginBottom: 8 }}>Summary</Text>
          <Text>Service: Deluxe Haircut (#{serviceId})</Text>
          <Text>Date: {dateLabel}</Text>
          <Text>Time: {slotLabel}</Text>
          <Divider style={{ marginTop: 8 }} />
        </View>

        {method === 'card' ? (
          <View style={{ marginTop: 12, gap: 12 }}>
            <TextInput mode="outlined" label="Card number" value={card.number} onChangeText={(t) => setCard({ ...card, number: t })} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TextInput style={{ flex: 1 }} mode="outlined" label="MM/YY" value={card.exp} onChangeText={(t) => setCard({ ...card, exp: t })} />
              <TextInput style={{ flex: 1 }} mode="outlined" label="CVC" value={card.cvc} onChangeText={(t) => setCard({ ...card, cvc: t })} />
            </View>
          </View>
        ) : (
          <View style={{ marginTop: 12 }}>
            <TextInput mode="outlined" label="Phone number" value={mpesa.phone} onChangeText={(t) => setMpesa({ phone: t })} />
          </View>
        )}

        <ActionButton style={{ marginTop: 16 }} onPress={() => router.push({ pathname: '/booking/confirmation', params: { serviceId, date: params.date, slot: params.slot } } as any)}>Continue</ActionButton>
      </View>
    </ScrollView>
  );
}


