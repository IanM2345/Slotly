// apps/mobile/lib/api/client.js
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

/* ------------------------------- Config ---------------------------------- */

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_API_URL_WEB ||
  'http://localhost:3000';

const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';

const DEFAULT_TIMEOUT_MS = 15_000;
const REFRESH_TIMEOUT_MS = 10_000;
const MAX_5XX_RETRIES = 3;

/* --------------------------- SecureStore utils --------------------------- */

async function getAccessToken() {
  try { return await SecureStore.getItemAsync(ACCESS_KEY); } catch { return null; }
}
async function setAccessToken(token) {
  try { if (token) await SecureStore.setItemAsync(ACCESS_KEY, token); } catch {}
}
async function getRefreshToken() {
  try { return await SecureStore.getItemAsync(REFRESH_KEY); } catch { return null; }
}
async function setRefreshToken(token) {
  try { if (token) await SecureStore.setItemAsync(REFRESH_KEY, token); } catch {}
}
async function clearSession() {
  try {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  } catch {}
}

/* ------------------------------- Axios ----------------------------------- */

const api = axios.create({
  baseURL: BASE_URL, // e.g., http://192.168.x.x:3000
  timeout: DEFAULT_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

/* ------------------------------ Auth utils ------------------------------- */

function setAuthHeader(config, token) {
  if (!config.headers) config.headers = {};
  if (token) config.headers.Authorization = `Bearer ${token}`;
  else delete config.headers.Authorization;
  return config;
}

/**
 * Centralized refresh function (single-flight via outer guards below).
 * Throws on failure. Returns the new access token string.
 */
async function refreshTokensOrThrow() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token');

  const resp = await axios.post(
    `${BASE_URL}/auth/refresh`,
    { refreshToken },
    { timeout: REFRESH_TIMEOUT_MS }
  );

  const { accessToken: newAccess, refreshToken: newRefresh } = resp.data || {};
  if (!newAccess) throw new Error('Missing access token from refresh');

  await setAccessToken(newAccess);
  if (newRefresh) await setRefreshToken(newRefresh);

  return newAccess;
}

/* -------------------- Refresh single-flight + queuing -------------------- */

let isRefreshing = false;
let refreshPromise = null;
const requestQueue = []; // { resolve, reject, config }

function flushQueue(error, token = null) {
  for (const { resolve, reject, config } of requestQueue) {
    if (error) {
      reject(error);
      continue;
    }
    if (token) setAuthHeader(config, token);
    resolve(api(config));
  }
  requestQueue.length = 0;
}

function enqueueRequest(config) {
  return new Promise((resolve, reject) => {
    requestQueue.push({ resolve, reject, config });
  });
}

/* ---------------------------- Error handling ----------------------------- */

function normalizeError(err) {
  // Timeout
  if (err?.code === 'ECONNABORTED') {
    return { message: 'Request timed out. Please try again.', code: 'TIMEOUT', status: 0 };
  }
  // Network / no response
  if (err?.message === 'Network Error' || !err?.response) {
    return { message: 'Network error. Check your connection.', code: 'NETWORK', status: 0 };
  }

  const { status, data } = err.response || {};
  const message =
    data?.error ||
    data?.message ||
    (status === 401 ? 'Unauthorized' :
     status === 403 ? 'Forbidden' :
     status === 404 ? 'Not found' :
     status >= 500 ? 'Server error' : 'Request failed');

  return { message, code: 'HTTP', status, details: data };
}

/* --------------------------- Interceptors: req --------------------------- */

api.interceptors.request.use(
  async (config) => {
    const token = await getAccessToken();
    return setAuthHeader(config, token);
  },
  (error) => Promise.reject(error),
);

/* -------------------------- Interceptors: res ---------------------------- */

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error?.config || {};

    /* ----- 429: gentle backoff once ----- */
    if (error?.response?.status === 429 && !original.__retry429) {
      original.__retry429 = true;
      const delay = 1_000 + Math.floor(Math.random() * 1_000);
      await new Promise((r) => setTimeout(r, delay));
      return api(original);
    }

    /* ----- 401: attempt refresh (single-flight) ----- */
    if (error?.response?.status === 401 && !original.__isRetryRequest) {
      original.__isRetryRequest = true;

      // If not already refreshing, start it
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = (async () => {
          try {
            const newAccess = await refreshTokensOrThrow();
            return newAccess;
          } finally {
            // Do NOT reset flags here—done after await below so we can flush
          }
        })();
      } else {
        // Queue this request until refresh finishes
        return enqueueRequest(original);
      }

      try {
        const newAccessToken = await refreshPromise;
        isRefreshing = false;
        flushQueue(null, newAccessToken);
        refreshPromise = null;

        setAuthHeader(original, newAccessToken);
        return api(original);
      } catch (e) {
        isRefreshing = false;
        flushQueue(e, null);
        refreshPromise = null;

        await clearSession();
        router.replace('/auth/login');
        return Promise.reject(normalizeError(e));
      }
    }

    /* ----- 5xx: retry with exponential backoff ----- */
    const status = error?.response?.status;
    if (status >= 500 && status <= 599) {
      const retries = original.__retries || 0;
      if (retries < MAX_5XX_RETRIES) {
        original.__retries = retries + 1;
        const base = 500 * Math.pow(2, retries);       // 500, 1000, 2000
        const jitter = Math.floor(Math.random() * 200); // small jitter
        await new Promise((r) => setTimeout(r, base + jitter));
        return api(original);
      }
    }

    // Everything else -> normalized error
    return Promise.reject(normalizeError(error));
  }
);

/* ------------------------- Exported auth helpers ------------------------- */

export async function setTokens({ accessToken, refreshToken }) {
  await setAccessToken(accessToken);
  if (refreshToken) await setRefreshToken(refreshToken);
}
export async function getTokens() {
  const [a, r] = await Promise.all([getAccessToken(), getRefreshToken()]);
  return { accessToken: a, refreshToken: r };
}
export async function clearTokens() {
  await clearSession();
}

export default api;
