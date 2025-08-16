
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import api from '../api/client';
import { getAccessToken, getRefreshToken, saveTokens, clearSessionStorage, isWeeklySessionExpired } from './session';
import { refreshSession, logout as apiLogout } from '../api/modules/auth'; // from your Step 3 module

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);    // { id, name, role, ... }
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // bootstrap from storage on app launch
  useEffect(() => {
    (async () => {
      const t = await getAccessToken();
      setToken(t);
      setLoading(false);
    })();
  }, []);

  // Optionally: fetch /users/me when token appears
  const hydrateUser = useCallback(async () => {
    if (!token) { setUser(null); return; }
    try {
      const { data } = await api.get('/users/me');
      setUser(data);
    } catch {
      // if bad token, clear and force relogin
      await signOut();
    }
  }, [token]);

  useEffect(() => { hydrateUser(); }, [hydrateUser]);

  const signInWithTokens = useCallback(async ({ accessToken, refreshToken }) => {
    await saveTokens({ accessToken, refreshToken });
    setToken(accessToken);
    // user will be hydrated by effect
  }, []);

  const signOut = useCallback(async () => {
    try { await apiLogout(); } catch {}
    await clearSessionStorage();
    setUser(null);
    setToken(null);
  }, []);

  const value = useMemo(() => ({
    user, token, loading, setUser, signInWithTokens, signOut,
  }), [user, token, loading, signInWithTokens, signOut]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
