import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  AccountDetails,
  PaymentMethod,
  Address,
  LanguageChoice,
  CountryChoice,
  FamilyMember,
  Review,
  Feedback,
  GiftCard,
} from './types';

const Keys = {
  account: 'settings:account',
  methods: 'settings:paymentMethods',
  defaultMethod: 'settings:defaultPaymentMethod',
  address: 'settings:address',
  language: 'settings:language',
  country: 'settings:country',
  family: 'settings:family',
  reviews: 'settings:reviews',
  notifications: 'settings:notifications',
  giftCards: 'settings:giftCards',
} as const;

async function getJSON<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

async function setJSON<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

// Seeders
async function ensureSeeds() {
  const account = await AsyncStorage.getItem(Keys.account);
  if (!account) {
    const seed: AccountDetails = { name: 'John Doe', email: 'john.doe@email.com', phone: '+254712345678', dob: '1990-01-15', serviceType: 'everyone' };
    await setJSON(Keys.account, seed);
  }
  const methods = await AsyncStorage.getItem(Keys.methods);
  if (!methods) {
    const seed: PaymentMethod[] = [
      { id: 'm1', type: 'card', brand: 'Visa', last4: '4242' },
      { id: 'm2', type: 'mpesa', mpesaPhone: '+254712345678' },
    ];
    await setJSON(Keys.methods, seed);
    await AsyncStorage.setItem(Keys.defaultMethod, 'm1');
  }
  const address = await AsyncStorage.getItem(Keys.address);
  if (!address) await setJSON(Keys.address, { country: 'Kenya' } as Address);
  if (!await AsyncStorage.getItem(Keys.language)) await AsyncStorage.setItem(Keys.language, 'auto');
  if (!await AsyncStorage.getItem(Keys.country)) await AsyncStorage.setItem(Keys.country, 'Kenya');
  if (!await AsyncStorage.getItem(Keys.family)) await setJSON(Keys.family, [] as FamilyMember[]);
  if (!await AsyncStorage.getItem(Keys.reviews)) await setJSON(Keys.reviews, [] as Review[]);
  if (!await AsyncStorage.getItem(Keys.notifications)) await AsyncStorage.setItem(Keys.notifications, 'true');
  if (!await AsyncStorage.getItem(Keys.giftCards)) await setJSON(Keys.giftCards, [] as GiftCard[]);
}

// Account
export async function getAccount(): Promise<AccountDetails> {
  await ensureSeeds();
  return getJSON<AccountDetails>(Keys.account, { name: '', email: '', phone: '', dob: '', serviceType: 'everyone' });
}
export async function updateAccount(partial: Partial<AccountDetails>): Promise<AccountDetails> {
  const current = await getAccount();
  const next = { ...current, ...partial };
  await setJSON(Keys.account, next);
  return next;
}

// Payment methods
export async function listPaymentMethods(): Promise<{ methods: PaymentMethod[]; defaultId: string | null }> {
  await ensureSeeds();
  const methods = await getJSON<PaymentMethod[]>(Keys.methods, []);
  const defaultId = await AsyncStorage.getItem(Keys.defaultMethod);
  return { methods, defaultId };
}
export async function addPaymentMethod(method: PaymentMethod): Promise<void> {
  const { methods } = await listPaymentMethods();
  await setJSON(Keys.methods, [...methods, method]);
}
export async function removePaymentMethod(id: string): Promise<void> {
  const { methods, defaultId } = await listPaymentMethods();
  const next = methods.filter(m => m.id !== id);
  await setJSON(Keys.methods, next);
  if (defaultId === id) await AsyncStorage.setItem(Keys.defaultMethod, next[0]?.id ?? '');
}
export async function setDefaultPaymentMethod(id: string): Promise<void> {
  await AsyncStorage.setItem(Keys.defaultMethod, id);
}

// Address
export async function getAddress(): Promise<Address> {
  await ensureSeeds();
  return getJSON<Address>(Keys.address, { country: '' });
}
export async function updateAddress(partial: Partial<Address>): Promise<Address> {
  const current = await getAddress();
  const next = { ...current, ...partial };
  await setJSON(Keys.address, next);
  return next;
}

// Language / Country
export async function getLanguage(): Promise<LanguageChoice> {
  await ensureSeeds();
  return (await AsyncStorage.getItem(Keys.language)) as LanguageChoice;
}
export async function setLanguage(lang: LanguageChoice): Promise<void> {
  await AsyncStorage.setItem(Keys.language, lang);
}
export async function getCountry(): Promise<CountryChoice> {
  await ensureSeeds();
  return (await AsyncStorage.getItem(Keys.country)) as CountryChoice;
}
export async function setCountry(country: CountryChoice): Promise<void> {
  await AsyncStorage.setItem(Keys.country, country);
}

// Family
export async function listFamily(): Promise<FamilyMember[]> {
  await ensureSeeds();
  return getJSON<FamilyMember[]>(Keys.family, []);
}
export async function addFamilyMember(member: FamilyMember): Promise<void> {
  const list = await listFamily();
  await setJSON(Keys.family, [member, ...list]);
}
export async function removeFamilyMember(id: string): Promise<void> {
  const list = await listFamily();
  await setJSON(Keys.family, list.filter(m => m.id !== id));
}

// Reviews
export async function createReview(review: Review): Promise<void> {
  const list = await getJSON<Review[]>(Keys.reviews, []);
  await setJSON(Keys.reviews, [review, ...list]);
}
export async function listReviews(): Promise<Review[]> {
  await ensureSeeds();
  return getJSON<Review[]>(Keys.reviews, []);
}

// Feedback
export async function sendFeedback(f: Feedback): Promise<void> {
  // noop, but could store last feedback
}

// Gift cards
export async function listGiftCards(): Promise<GiftCard[]> {
  await ensureSeeds();
  return getJSON<GiftCard[]>(Keys.giftCards, []);
}
export async function purchaseGiftCard(card: GiftCard): Promise<void> {
  const list = await listGiftCards();
  await setJSON(Keys.giftCards, [card, ...list]);
}

// Notifications
export async function getNotificationsEnabled(): Promise<boolean> {
  await ensureSeeds();
  return (await AsyncStorage.getItem(Keys.notifications)) !== 'false';
}
export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(Keys.notifications, enabled ? 'true' : 'false');
}





