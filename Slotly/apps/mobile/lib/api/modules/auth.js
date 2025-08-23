// apps/mobile/lib/api/modules/auth.js
import api, { setTokens, clearTokens, getTokens } from "../client";
import * as SecureStore from "expo-secure-store";

// ================== Config ==================
const SESSION_STARTED_AT_KEY = "sessionStartedAt";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ========== Storage helpers ==========
async function markSessionStart() {
  try { 
    await SecureStore.setItemAsync(SESSION_STARTED_AT_KEY, String(Date.now())); 
  } catch (error) {
    console.warn('Failed to mark session start:', error);
  }
}

async function clearSessionStart() {
  try { 
    await SecureStore.deleteItemAsync(SESSION_STARTED_AT_KEY); 
  } catch (error) {
    console.warn('Failed to clear session start:', error);
  }
}

// ========== Session helpers ==========
export async function isSessionExpiredWeekly() {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_STARTED_AT_KEY);
    if (!raw) return true;
    
    const startedAt = Number(raw);
    if (!Number.isFinite(startedAt)) return true;
    
    return (Date.now() - startedAt) > SESSION_MAX_AGE_MS;
  } catch (error) { 
    console.warn('Failed to check session expiry:', error);
    return true; 
  }
}

export async function getStoredTokens() {
  return await getTokens();
}

// ================== Auth flows ==================

/**
 * Login with email/phone and password
 * Enhanced with better error handling and validation
 */
export async function login({ email, phone, password }) {
  try {
    console.log('🔐 Attempting login...');
    
    // Validate required fields
    if (!email && !phone) {
      throw new Error('Email or phone is required');
    }
    
    if (!password && process.env.NODE_ENV !== 'development') {
      throw new Error('Password is required');
    }

    const { data } = await api.post("/api/auth/login", { 
      email, 
      phone, 
      password 
    });
    
    if (!data) {
      throw new Error('No response data received');
    }
    
    // Store tokens if provided
    if (data?.token && data?.refreshToken) {
      await setTokens({ 
        accessToken: data.token, 
        refreshToken: data.refreshToken 
      });
      await markSessionStart();
      console.log('✅ Login tokens stored successfully');
    } else {
      console.warn('⚠️ Login response missing tokens');
    }
    
    // Immediately load user data to verify auth
    let user = null;
    try {
      user = await meHeartbeat(); // <- This now returns the user object directly
      console.log('✅ User data loaded:', user?.email || user?.phone);
    } catch (userError) {
      console.warn('⚠️ Failed to load user data after login:', userError.message);
      // Don't fail login if user fetch fails, just return what we have
    }
    
    return { 
      ...data, 
      user: user || data.user
    };
    
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    
    // Clear any partial session data on login failure
    await clearSession();
    
    throw new Error(
      error.response?.data?.error || 
      error.response?.data?.message || 
      error.message ||
      'Login failed'
    );
  }
}

/**
 * Signup initiate - starts the signup process
 */
export async function signupInitiate({ firstName, lastName, email, phone, password }) {
  try {
    console.log('📝 Initiating signup...');
    
    const name = `${firstName} ${lastName}`.trim();
    
    // Validate required fields
    if (!name) throw new Error('Name is required');
    if (!email && !phone) throw new Error('Email or phone is required');
    if (!password) throw new Error('Password is required');
    
    const { data } = await api.post("/api/auth/signup/initiate", { 
      name, 
      email, 
      phone, 
      password 
    });
    
    console.log('✅ Signup initiated successfully');
    return data;
    
  } catch (error) {
    console.error('❌ Signup initiate failed:', error.message);
    throw new Error(
      error.response?.data?.error || 
      error.response?.data?.message || 
      error.message ||
      'Signup initiation failed'
    );
  }
}

/**
 * Signup verify - completes the signup process
 * Note: preserving backend typo "verfiy" for compatibility
 */
export async function signupVerify(payload) {
  try {
    console.log('✅ Verifying signup...');
    
    const { data } = await api.post("/api/auth/signup/verfiy", payload);
    
    // Store tokens if provided
    if (data?.token && data?.refreshToken) {
      await setTokens({ 
        accessToken: data.token, 
        refreshToken: data.refreshToken 
      });
      await markSessionStart();
      console.log('✅ Signup verification tokens stored');
    }
    
    // Load user data
    let user = null;
    try {
      user = await meHeartbeat(); // <- This now returns the user object directly
      console.log('✅ New user data loaded:', user?.email || user?.phone);
    } catch (userError) {
      console.warn('⚠️ Failed to load user data after signup:', userError.message);
    }
    
    return { 
      ...data, 
      user: user || data.user
    };
    
  } catch (error) {
    console.error('❌ Signup verification failed:', error.message);
    throw new Error(
      error.response?.data?.error || 
      error.response?.data?.message || 
      error.message ||
      'Signup verification failed'
    );
  }
}

/**
 * Logout - clears session and notifies backend
 */
export async function logout() {
  try {
    console.log('👋 Logging out...');
    
    // Attempt to notify backend
    try { 
      await api.post("/api/auth/logout"); 
      console.log('✅ Backend logout successful');
    } catch (logoutError) {
      console.warn('⚠️ Backend logout failed, continuing with local cleanup:', logoutError.message);
    }
    
    // Always clear local session
    await clearSession();
    
    console.log('✅ Logout completed');
    return { ok: true };
    
  } catch (error) {
    console.error('❌ Logout error:', error);
    // Even if logout fails, try to clear local data
    await clearSession();
    return { ok: true };
  }
}

/**
 * Manual refresh session
 * This is mostly handled by the API client's interceptors
 * But we keep it for manual refresh scenarios
 */
export async function refreshSession() {
  try {
    const { refreshToken } = await getTokens();
    if (!refreshToken) {
      console.log('❌ No refresh token available');
      return null;
    }
    
    console.log('🔄 Manually refreshing session...');
    
    const { data } = await api.post("/api/auth/refresh", { refreshToken });
    
    if (data?.accessToken) {
      await setTokens({ 
        accessToken: data.accessToken, 
        refreshToken: data.refreshToken || refreshToken 
      });
      await markSessionStart();
      console.log('✅ Manual session refresh successful');
      return data;
    }
    
    console.log('❌ Manual refresh failed - no access token in response');
    return null;
    
  } catch (error) {
    console.error('❌ Manual refresh failed:', error.message);
    // Clear tokens on refresh failure
    await clearSession();
    return null;
  }
}

/**
 * Clear all session data locally
 */
export async function clearSession() {
  try {
    await clearTokens();
    await clearSessionStart();
    console.log('✅ Session cleared');
  } catch (error) {
    console.error('❌ Failed to clear session:', error);
  }
}

/**
 * Full logout with backend notification
 */
export async function logoutFull() {
  return await logout(); // Same as regular logout
}

/**
 * Heartbeat - fetch current user data
 * FIXED: Now normalizes API response to return user object directly
 */
export async function meHeartbeat() {
  try {
    const { data } = await api.get("/api/auth/me");
    
    // Normalize response: if backend returns { user: {...} }, return user; otherwise return data as-is
    return data && typeof data === "object" && data.user ? data.user : data;
    
  } catch (error) {
    console.error('❌ Me heartbeat failed:', error.message);
    throw new Error(
      error.response?.data?.error || 
      error.response?.data?.message || 
      error.message ||
      'Failed to fetch user data'
    );
  }
}

/**
 * Check if user is authenticated (has valid tokens)
 */
export async function isAuthenticated() {
  try {
    const { accessToken } = await getStoredTokens();
    return !!accessToken;
  } catch (error) {
    console.warn('Failed to check authentication status:', error);
    return false;
  }
}

/**
 * Get current user if authenticated, null otherwise
 */
export async function getCurrentUser() {
  try {
    if (!(await isAuthenticated())) {
      return null;
    }
    
    return await meHeartbeat();
  } catch (error) {
    console.warn('Failed to get current user:', error.message);
    return null;
  }
}

/**
 * Check authentication status with detailed info
 */
export async function getAuthStatus() {
  try {
    const { accessToken, refreshToken } = await getStoredTokens();
    const hasTokens = !!(accessToken && refreshToken);
    const isExpired = await isSessionExpiredWeekly();
    
    return {
      isAuthenticated: hasTokens && !isExpired,
      hasTokens,
      isExpired,
      needsRefresh: hasTokens && isExpired
    };
  } catch (error) {
    console.warn('Failed to get auth status:', error);
    return {
      isAuthenticated: false,
      hasTokens: false,
      isExpired: true,
      needsRefresh: false
    };
  }
}

// Export all storage helpers for direct use
export {
  markSessionStart,
  clearSessionStart
};