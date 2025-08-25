import React, { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import {
  Text, TextInput, Button, Surface, IconButton, Menu, useTheme, Snackbar
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSession } from '../../context/SessionContext';
import { getMyAddress, updateMyAddress } from '../../lib/api/modules/users';

type AddressType = {
  county?: string;
  city?: string;
  constituency?: string;
  street?: string;
  apartment?: string;
};

export default function AddressScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { token } = useSession();

  const [loading, setLoading] = useState(false);
  const [addressData, setAddressData] = useState<AddressType>({
    county: 'Kenya', city: '', constituency: '', street: '', apartment: ''
  });
  const [snack, setSnack] = useState<{ visible: boolean; msg: string }>({ visible: false, msg: '' });

  const [countyMenuVisible, setCountyMenuVisible] = useState(false);
  const [constituencyMenuVisible, setConstituencyMenuVisible] = useState(false);

  const counties = ['Nairobi','Mombasa','Kisumu','Nakuru','Eldoret','Thika','Malindi','Kitale'];
  const constituencies = ['Westlands','Langata','Kasarani','Embakasi','Dagoretti','Kibra','Mathare','Starehe'];

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const addr = await getMyAddress(token);
      setAddressData({
        county: addr.county ?? 'Kenya',
        city: addr.city ?? '',
        constituency: addr.constituency ?? '',
        street: addr.street ?? '',
        apartment: addr.apartment ?? ''
      });
    } catch (_) {
      // keep defaults
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleBack = () => router.back();

  const handleSave = async () => {
    if (!token) return;
    setLoading(true);
    try {
      await updateMyAddress(addressData, token);
      setSnack({ visible: true, msg: 'Address saved' });
      setTimeout(() => router.back(), 800);
    } catch (error) {
      console.error('Error saving address:', error);
      setSnack({ visible: true, msg: 'Failed to save address' });
    } finally {
      setLoading(false);
    }
  };

  const updateAddressData = (field: keyof AddressType, value: string) => {
    setAddressData(prev => ({ ...prev, [field]: value }));
  };

  const handleCountySelect = (county: string) => {
    updateAddressData('county', county);
    setCountyMenuVisible(false);
  };
  const handleConstituencySelect = (c: string) => {
    updateAddressData('constituency', c);
    setConstituencyMenuVisible(false);
  };

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" size={24} iconColor={theme.colors.onSurface} onPress={handleBack} />
        <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>Address</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Menu
              visible={countyMenuVisible}
              onDismiss={() => setCountyMenuVisible(false)}
              anchor={
                <TextInput
                  mode="outlined"
                  label="County"
                  value={addressData.county ?? ''}
                  style={styles.textInput}
                  outlineColor={theme.colors.outline}
                  activeOutlineColor={theme.colors.primary}
                  textColor={theme.colors.onSurface}
                  editable={false}
                  right={<TextInput.Icon icon="chevron-down" onPress={() => setCountyMenuVisible(true)} />}
                  onPressIn={() => setCountyMenuVisible(true)}
                />
              }
              contentStyle={styles.menuContent}
            >
              {counties.map((county) => (
                <Menu.Item key={county} onPress={() => handleCountySelect(county)} title={county} titleStyle={styles.menuItemText} />
              ))}
            </Menu>
          </View>

          <TextInput
            mode="outlined"
            label="City (Optional)"
            value={addressData.city ?? ''}
            onChangeText={(text) => updateAddressData('city', text)}
            style={styles.textInput}
            outlineColor={theme.colors.outline}
            activeOutlineColor={theme.colors.primary}
            textColor={theme.colors.onSurface}
            autoCapitalize="words"
          />

          <View style={styles.inputContainer}>
            <Menu
              visible={constituencyMenuVisible}
              onDismiss={() => setConstituencyMenuVisible(false)}
              anchor={
                <TextInput
                  mode="outlined"
                  label="Constituency"
                  value={addressData.constituency ?? ''}
                  style={styles.textInput}
                  outlineColor={theme.colors.outline}
                  activeOutlineColor={theme.colors.primary}
                  textColor={theme.colors.onSurface}
                  editable={false}
                  right={<TextInput.Icon icon="chevron-down" onPress={() => setConstituencyMenuVisible(true)} />}
                  onPressIn={() => setConstituencyMenuVisible(true)}
                />
              }
              contentStyle={styles.menuContent}
            >
              {constituencies.map((c) => (
                <Menu.Item key={c} onPress={() => handleConstituencySelect(c)} title={c} titleStyle={styles.menuItemText} />
              ))}
            </Menu>
          </View>

          <TextInput
            mode="outlined"
            label="Street"
            value={addressData.street ?? ''}
            onChangeText={(text) => updateAddressData('street', text)}
            style={styles.textInput}
            outlineColor={theme.colors.outline}
            activeOutlineColor={theme.colors.primary}
            textColor={theme.colors.onSurface}
            autoCapitalize="words"
          />

          <TextInput
            mode="outlined"
            label="Apartment/House Number (Optional)"
            value={addressData.apartment ?? ''}
            onChangeText={(text) => updateAddressData('apartment', text)}
            style={styles.textInput}
            outlineColor={theme.colors.outline}
            activeOutlineColor={theme.colors.primary}
            textColor={theme.colors.onSurface}
            autoCapitalize="characters"
          />
        </View>

        <View style={styles.saveButtonContainer}>
          <Button mode="contained" onPress={handleSave} loading={loading} disabled={loading} style={styles.saveButton} labelStyle={styles.saveButtonText} contentStyle={styles.saveButtonContent}>
            Save
          </Button>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      <Snackbar visible={snack.visible} onDismiss={() => setSnack({ visible: false, msg: '' })} duration={2000}>
        {snack.msg}
      </Snackbar>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1 },
  header:{ flexDirection:'row', alignItems:'center', paddingHorizontal:8, paddingTop:16, paddingBottom:8 },
  headerTitle:{ flex:1, fontSize:24, fontWeight:'bold', textAlign:'center' },
  headerSpacer:{ width:48 },
  scrollView:{ flex:1, paddingHorizontal:16 },
  formContainer:{ paddingTop:24, gap:20, marginBottom:40 },
  inputContainer:{ position:'relative' },
  textInput:{ backgroundColor:'transparent' },
  menuContent:{ maxHeight:200 },
  menuItemText:{ fontSize:16 },
  saveButtonContainer:{ marginBottom:24 },
  saveButton:{ borderRadius:25 },
  saveButtonContent:{ paddingVertical:12 },
  saveButtonText:{ fontSize:18, fontWeight:'bold' },
  bottomSpacing:{ height:32 },
});