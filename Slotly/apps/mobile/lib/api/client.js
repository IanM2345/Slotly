// apps/mobile/lib/api/client.js
import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

/* ------------------------------- Config ---------------------------------- */

// Enhanced base URL resolution with environment variable priority
function resolveBaseURL() {
  // Get the host from Expo's config (works for physical devices on same network)
  const hostFromExpo = Constants.expoConfig?.hostUri?.split(':')?.[0];
  
  if (__DEV__) {
    console.log('🔧 DEV MODE: Resolving API base URL...');
    console.log('Platform:', Platform.OS);
    console.log('Host from Expo:', hostFromExpo);
    console.log('EXPO_PUBLIC_API_URL:', process.env.EXPO_PUBLIC_API_URL);
    console.log('EXPO_PUBLIC_API_URL_WEB:', process.env.EXPO_PUBLIC_API_URL_WEB);
    
    // Check if we're running on web
    if (Platform.OS === 'web') {
      const webUrl = process.env.EXPO_PUBLIC_API_URL_WEB || 'http://localhost:3000';
      console.log('🌐 Web platform detected, using:', webUrl);
      return webUrl;
    }
    
    // For mobile platforms, prioritize environment variable for physical devices
    if (process.env.EXPO_PUBLIC_API_URL) {
      console.log('📱 Using EXPO_PUBLIC_API_URL:', process.env.EXPO_PUBLIC_API_URL);
      return process.env.EXPO_PUBLIC_API_URL;
    }
    
    // Fallback to platform-specific defaults for emulators/simulators
    if (Platform.OS === 'android') {
      // Check if it's likely an emulator vs physical device
      if (!hostFromExpo || hostFromExpo === 'localhost') {
        const url = 'http://10.0.2.2:3000';
        console.log('📱 Android emulator detected, using:', url);
        return url;
      }
    }
    
    if (Platform.OS === 'ios') {
      // Check if it's likely a simulator vs physical device  
      if (!hostFromExpo || hostFromExpo === 'localhost') {
        const url = 'http://localhost:3000';
        console.log('📱 iOS simulator detected, using:', url);
        return url;
      }
    }
    
    // Physical device fallback - use detected network IP
    if (hostFromExpo && hostFromExpo !== 'localhost') {
      const url = `http://${hostFromExpo}:3000`;
      console.log('📱 Physical device fallback, using network IP:', url);
      return url;
    }
    
    // Final fallback
    const url = 'http://localhost:3000';
    console.log('🌐 Final fallback to localhost:', url);
    return url;
  }
  
  // Production API
  const prodUrl = process.env.EXPO_PUBLIC_API_URL || 'https://api.slotly.co.ke';
  console.log('🚀 Production mode, using:', prodUrl);
  return prodUrl;
}

const BASE_URL = resolveBaseURL();
const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';

// Updated timeouts - longer default timeout for Next.js dev compilation
const DEFAULT_TIMEOUT = 
  Number(process.env.EXPO_PUBLIC_API_TIMEOUT ?? 25000); // 25s for first-compile hits
const REFRESH_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;

/* --------------------------- SecureStore utils --------------------------- */

async function getAccessToken() {
  try { 
    return await SecureStore.getItemAsync(ACCESS_KEY); 
  } catch (error) {
    console.warn('Failed to get access token:', error);
    return null; 
  }
}

async function setAccessToken(token) {
  try { 
    if (token) {
      await SecureStore.setItemAsync(ACCESS_KEY, token);
    }
  } catch (error) {
    console.warn('Failed to set access token:', error);
  }
}

async function getRefreshToken() {
  try { 
    return await SecureStore.getItemAsync(REFRESH_KEY); 
  } catch (error) {
    console.warn('Failed to get refresh token:', error);
    return null; 
  }
}

async function setRefreshToken(token) {
  try { 
    if (token) {
      await SecureStore.setItemAsync(REFRESH_KEY, token);
    }
  } catch (error) {
    console.warn('Failed to set refresh token:', error);
  }
}

async function clearSession() {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_KEY),
      SecureStore.deleteItemAsync(REFRESH_KEY)
    ]);
  } catch (error) {
    console.warn('Failed to clear session:', error);
  }
}

/* ------------------------------- Axios ----------------------------------- */

const api = axios.create({
  baseURL: BASE_URL,
  timeout: DEFAULT_TIMEOUT,
  headers: { 
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
});

// Log the final configuration for debugging
if (__DEV__) {
  console.log('🔗 API Client initialized with baseURL:', BASE_URL, 'timeout:', DEFAULT_TIMEOUT);
}

/* ------------------------------ Auth utils ------------------------------- */

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

function setAuthHeader(config, token) {
  if (!config.headers) config.headers = {};
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }
  return config;
}

/**
 * Centralized refresh function with better error handling
 */
async function refreshTokensOrThrow() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  console.log('🔄 Attempting token refresh...');

  try {
    const resp = await axios.post(
      `${BASE_URL}/api/auth/refresh`,
      { refreshToken },
      { 
        timeout: REFRESH_TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    const { accessToken: newAccess, refreshToken: newRefresh } = resp.data || {};
    
    if (!newAccess) {
      throw new Error('No access token in refresh response');
    }

    await setAccessToken(newAccess);
    
    // Handle refresh token rotation
    if (newRefresh && newRefresh !== refreshToken) {
      await setRefreshToken(newRefresh);
    }

    console.log('✅ Token refresh successful');
    return newAccess;
    
  } catch (error) {
    console.error('❌ Token refresh failed:', error.message);
    throw error;
  }
}

/* -------------------- Refresh single-flight + queuing -------------------- */

let isRefreshing = false;
let refreshPromise = null;
const requestQueue = [];

function flushQueue(error, token = null) {
  console.log(`📤 Flushing ${requestQueue.length} queued requests...`);
  
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
  console.log('🔥 Queueing request while token refresh in progress...');
  return new Promise((resolve, reject) => {
    requestQueue.push({ resolve, reject, config });
  });
}

/* --------------------------- Interceptors: req --------------------------- */

api.interceptors.request.use(
  async (config) => {
    // Skip auth for auth endpoints
    const isAuthEndpoint = /\/api\/auth\/(login|signup|refresh)/.test(config.url || '');
    
    if (!isAuthEndpoint) {
      const token = await getAccessToken();
      if (token) {
        setAuthHeader(config, token);
      }
    }

    // Enhanced logging for debugging
    if (__DEV__) {
      console.log(`🚀 ${config.method?.toUpperCase()} ${config.url}`);
      console.log(`   BaseURL: ${config.baseURL}`);
      console.log(`   Has Auth: ${!!config.headers?.Authorization}`);
      console.log(`   Timeout: ${config.timeout || 'default'}ms`);
    }

    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

/* -------------------------- Interceptors: res ---------------------------- */

function normalizeError(err) {
  // Network timeout
  if (err?.code === 'ECONNABORTED') {
    return { 
      message: 'Request timed out. Please check your connection and try again.', 
      code: 'TIMEOUT', 
      status: 0 
    };
  }
  
  // Network connectivity issues
  if (err?.message === 'Network Error' || !err?.response) {
    return { 
      message: 'Unable to reach the server. Please check your internet connection.', 
      code: 'NETWORK', 
      status: 0,
      details: {
        originalMessage: err?.message,
        url: err?.config?.url,
        baseURL: err?.config?.baseURL
      }
    };
  }
  
  // HTTP errors
  const { status, data } = err.response || {};
  
  // Enhanced 401 error messages for better UX
  if (status === 401) {
    const message = 
      data?.error ||
      data?.message ||
      "You're not signed in or your session has expired. Please sign in.";
    
    return { 
      message, 
      code: 'HTTP', 
      status, 
      details: data 
    };
  }
  
  // Other HTTP errors
  const message =
    data?.error ||
    data?.message ||
    (status === 403 ? 'Access denied' :
     status === 404 ? 'Resource not found' :
     status === 429 ? 'Too many requests. Please wait and try again.' :
     status >= 500 ? 'Server error. Please try again later.' : 'Request failed');
     
  return { 
    message, 
    code: 'HTTP', 
    status, 
    details: data 
  };
}

api.interceptors.response.use(
  (res) => {
    if (__DEV__ && res.config) {
      console.log(`✅ ${res.config.method?.toUpperCase()} ${res.config.url} - ${res.status}`);
    }
    return res;
  },
  async (error) => {
    const original = error?.config || {};
    const status = error?.response?.status;

    // Enhanced 401 message handling - set friendly message before other processing
    if (status === 401) {
      error.message = 
        error?.response?.data?.error ||
        "You're not signed in or your session has expired. Please sign in.";
    }

    if (__DEV__) {
      console.log(`❌ ${original.method?.toUpperCase()} ${original.url} - ${status || 'NO_STATUS'}`);
      if (!error?.response) {
        console.log('   Network error details:', {
          message: error?.message,
          code: error?.code,
          baseURL: original.baseURL,
          url: original.url,
          fullURL: `${original.baseURL}${original.url}`
        });
      }
    }

    // 429: Rate limit - single retry with backoff
    if (status === 429 && !original.__retry429) {
      original.__retry429 = true;
      const delay = 1000 + Math.floor(Math.random() * 1000);
      console.log(`⏳ Rate limited, retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
      return api(original);
    }

    // 5xx: Server errors - exponential backoff
    if (status >= 500 && status <= 599) {
      const retries = original.__retries || 0;
      if (retries < MAX_RETRIES) {
        original.__retries = retries + 1;
        const base = 500 * Math.pow(2, retries);
        const jitter = Math.floor(Math.random() * 200);
        const delay = base + jitter;
        console.log(`⏳ Server error, retry ${retries + 1}/${MAX_RETRIES} in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        return api(original);
      }
    }

    // 401: Authentication errors
    const isAuthPath = String(original.url || '').includes('/api/auth/');
    if (status === 401 && !isAuthPath && !original._retryAfterRefresh) {
      original._retryAfterRefresh = true;

      // Check if we have a refresh token
      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        console.log('❌ No refresh token available, redirecting to login...');
        await clearSession();
        delete api.defaults.headers.common.Authorization;
        try { router.replace('/auth/login'); } catch {}
        return Promise.reject(normalizeError(error));
      }

      // If already refreshing, queue this request
      if (isRefreshing) {
        return enqueueRequest(original);
      }

      // Start refresh process
      isRefreshing = true;
      refreshPromise = refreshTokensOrThrow();

      try {
        const newToken = await refreshPromise;
        isRefreshing = false;
        refreshPromise = null;
        
        // Update global auth and flush queue
        setAuthToken(newToken);
        flushQueue(null, newToken);
        
        // Retry original request with new token
        setAuthHeader(original, newToken);
        return api(original);
        
      } catch (refreshError) {
        isRefreshing = false;
        refreshPromise = null;
        flushQueue(refreshError);
        
        console.log('❌ Token refresh failed, redirecting to login...');
        await clearSession();
        delete api.defaults.headers.common.Authorization;
        
        try { router.replace('/auth/login'); } catch {}
        return Promise.reject(normalizeError(refreshError));
      }
    }

    return Promise.reject(normalizeError(error));
  }
);

/* ------------------------- Exported token helpers ------------------------ */

export async function setTokens({ accessToken, refreshToken }) {
  if (accessToken) {
    await setAccessToken(accessToken);
    setAuthToken(accessToken);
  }
  if (refreshToken !== undefined) {
    await setRefreshToken(refreshToken);
  }
}

export async function getTokens() {
  const [accessToken, refreshToken] = await Promise.all([
    getAccessToken(),
    getRefreshToken()
  ]);
  return { accessToken, refreshToken };
}

export async function clearTokens() {
  await clearSession();
  delete api.defaults.headers.common.Authorization;
}

// Export individual token functions for compatibility
export { 
  getAccessToken, 
  getRefreshToken,
  clearSession 
};

export default api;