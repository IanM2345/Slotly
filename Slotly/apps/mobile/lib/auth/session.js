
import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'slotly_access_token';
const REFRESH_KEY = 'slotly_refresh_token';
const SESSION_STARTED_AT_KEY = 'slotly_session_started_at';

export async function saveTokens({ accessToken, refreshToken }) {
  if (accessToken) await SecureStore.setItemAsync(ACCESS_KEY, accessToken);
  if (refreshToken) await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
  await SecureStore.setItemAsync(SESSION_STARTED_AT_KEY, String(Date.now()));
}

export async function getAccessToken() {
  try { return await SecureStore.getItemAsync(ACCESS_KEY); } catch { return null; }
}
export async function getRefreshToken() {
  try { return await SecureStore.getItemAsync(REFRESH_KEY); } catch { return null; }
}

export async function clearSessionStorage() {
  try {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    await SecureStore.deleteItemAsync(SESSION_STARTED_AT_KEY);
  } catch {}
}

export async function isWeeklySessionExpired() {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_STARTED_AT_KEY);
    if (!raw) return true;
    const started = Number(raw);
    const WEEK = 7 * 24 * 60 * 60 * 1000;
    return Number.isFinite(started) && (Date.now() - started > WEEK);
  } catch { return true; }
}
