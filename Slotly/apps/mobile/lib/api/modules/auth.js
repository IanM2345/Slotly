// apps/mobile/lib/api/modules/auth.js
import api, { setTokens, clearTokens, getTokens } from "../client";
import * as SecureStore from "expo-secure-store";

// ================== Config ==================
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://your-backend-host";
const SESSION_STARTED_AT_KEY = "sessionStartedAt";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ================== Current Path Provider ==================
// A pluggable provider so we can always pass the current path to /auth/me
let _currentPath = "/";
export function setCurrentPath(path) { 
  _currentPath = typeof path === "string" && path ? path : "/"; 
}
export function getCurrentPath() { 
  return _currentPath || "/"; 
}

// ================== JWT Utils ==================
export function decodeJwt(token) {
  try {
    if (!token || typeof token !== "string" || !token.includes(".")) return {};
    const [, payloadB64] = token.split(".");
    const json = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return {};
  }
}

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

// ================== API Logout Client ==================
/**
 * Call the backend logout endpoint to revoke refresh tokens
 */
export async function apiLogout(accessToken, opts = {}) {
  const { allDevices = true, refreshToken } = opts;
  
  try {
    const res = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`, // Required by your backend route
      },
      body: JSON.stringify({
        allDevices, // revoke all refresh tokens by default
        refreshToken, // pass if you're storing it locally
      }),
    });

    // Your route returns 200 { ok: true } (and handles OPTIONS as well)
    if (!res.ok) {
      // Don't block logout on network errors — we'll still clear local state
      // but bubble up for logging if you want
      try {
        const data = await res.json();
        throw new Error(data?.error || `Logout failed (${res.status})`);
      } catch {
        throw new Error(`Logout failed (${res.status})`);
      }
    }

    const data = await res.json();
    console.log("✅ Backend logout successful:", data);
    return true;
    
  } catch (error) {
    console.warn("⚠️ Backend logout failed (continuing with local cleanup):", error.message);
    // Don't throw - allow local cleanup to continue
    return false;
  }
}

// ================== Auth flows ==================

/**
 * Login with email/phone and password
 * Enhanced with session tracking and better error handling
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
    if (data?.token) {
      await setTokens({ 
        accessToken: data.token, 
        refreshToken: data.refreshToken 
      });
      await markSessionStart();
      console.log('✅ Login tokens stored successfully');
    } else {
      console.warn('⚠️ Login response missing tokens');
    }
    
    // Extract sessionJti from refresh token for session tracking
    let sessionJti = null;
    if (data?.refreshToken) {
      sessionJti = decodeJwt(data.refreshToken)?.jti || null;
    }
    
    // Immediately ping /auth/me with session tracking
    let user = null;
    try {
      user = await meHeartbeat({
        accessToken: data?.token,
        sessionJti,
        currentPath: getCurrentPath(),
      });
      console.log('✅ User data loaded with session tracking:', user?.email || user?.phone);
    } catch (userError) {
      console.warn('⚠️ Failed to load user data after login:', userError.message);
    }
    
    return { 
      ...data, 
      user: user?.user || user || data.user,
      sessionJti
    };
    
  } catch (error) {
    console.error('❌ Login failed:', error.message);
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
    console.log('🔐 Initiating signup...');
    
    const name = `${firstName || ""} ${lastName || ""}`.trim();
    
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
    if (data?.token) {
      await setTokens({ 
        accessToken: data.token, 
        refreshToken: data.refreshToken 
      });
      await markSessionStart();
      console.log('✅ Signup verification tokens stored');
    }
    
    // Extract sessionJti for session tracking
    let sessionJti = null;
    if (data?.refreshToken) {
      sessionJti = decodeJwt(data.refreshToken)?.jti || null;
    }
    
    // Load user data with session tracking
    let user = null;
    try {
      user = await meHeartbeat({
        accessToken: data?.token,
        sessionJti,
        currentPath: getCurrentPath(),
      });
      console.log('✅ New user data loaded with session tracking:', user?.email || user?.phone);
    } catch (userError) {
      console.warn('⚠️ Failed to load user data after signup:', userError.message);
    }
    
    return { 
      ...data, 
      user: user?.user || user || data.user,
      sessionJti
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
 * Enhanced to use the new apiLogout function
 */
export async function logout() {
  try {
    console.log('👋 Logging out...');
    
    // Get current tokens before clearing
    const { accessToken, refreshToken } = await getTokens().catch(() => ({}));
    
    // Attempt to notify backend and revoke refresh tokens
    if (accessToken) {
      try {
        await apiLogout(accessToken, { 
          allDevices: true, // revoke all sessions by default
          refreshToken 
        });
        console.log('✅ Backend logout successful');
      } catch (logoutError) {
        console.warn('⚠️ Backend logout failed, continuing with local cleanup:', logoutError.message);
      }
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
    await clearSession();
    return null;
  }
}

/**
 * Clear all session data locally
 * Enhanced to clear all auth-related storage
 */
export async function clearSession() {
  try {
    // Clear tokens via client helper
    await clearTokens();
    
    // Clear session timing
    await clearSessionStart();
    
    // Clear any other auth-related keys
    const keysToCleanup = [
      "access_token", // legacy key if it exists
      "refresh_token", // legacy key if it exists
      "user_data", // if you cache user data
    ];
    
    for (const key of keysToCleanup) {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch (e) {
        // Ignore individual key failures
      }
    }
    
    console.log('✅ Session cleared');
  } catch (error) {
    console.error('❌ Failed to clear session:', error);
  }
}

// ================== Enhanced Heartbeat with Session Tracking ==================
/**
 * meHeartbeat - fetch current user data with per-page tracking
 * @param {Object} options - Configuration options
 * @param {string} options.accessToken - Optional access token (will use stored if not provided)
 * @param {string} options.sessionJti - Optional refresh token JTI for session tracking
 * @param {string} options.currentPath - Optional current path (will use global if not provided)
 */
export async function meHeartbeat({ accessToken, sessionJti, currentPath } = {}) {
  try {
    // Get tokens from storage if not provided
    const tokens = await getTokens().catch(() => ({}));
    const token = accessToken || tokens?.accessToken || "";
    
    if (!token) {
      throw new Error('No access token available');
    }
    
    // Build headers with session tracking
    const headers = { Authorization: `Bearer ${token}` };
    
    // Add session tracking headers if available
    if (sessionJti) {
      headers["X-Session"] = String(sessionJti);
    }
    
    const path = currentPath || getCurrentPath() || "/";
    headers["X-Path"] = path;
    
    // Add app build info if available
    if (process.env.EXPO_PUBLIC_APP_VERSION) {
      headers["X-App-Build"] = process.env.EXPO_PUBLIC_APP_VERSION;
    }
    
    const { data } = await api.get("/api/auth/me", { headers });
    
    // Normalize response: backend returns { ok, user, ... } or just user data
    return data && typeof data === "object" && data.user ? data : { user: data };
    
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
    
    const result = await meHeartbeat({ currentPath: getCurrentPath() });
    return result?.user || result;
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

/**
 * Password reset flows
 */
export async function requestPasswordReset(email) {
  const { data } = await api.post("/auth/forgot-password", { email });
  return data; // { message, devToken?, devResetUrl? }
}

export async function confirmPasswordReset({ token, newPassword }) {
  const { data } = await api.post("/auth/reset-password", { token, newPassword });
  return data; // { message: 'Password updated' }
}

// Export storage helpers for direct use
export {
  markSessionStart,
  clearSessionStart
};