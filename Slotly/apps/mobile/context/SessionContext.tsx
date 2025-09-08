// apps/mobile/context/SessionContext.tsx
import * as SecureStore from "expo-secure-store";
import React, { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "expo-router";
import { meHeartbeat, decodeJwt, setCurrentPath, apiLogout } from "../lib/api/modules/auth";
import { jsonFetch } from "../lib/api/modules/_fetch";
import api, { setAuthToken, getTokens } from "../lib/api/client";

// Optional Sentry (won't crash if not installed)
let Sentry: any = null;
try {
  // Prefer sentry-expo, fallback to @sentry/react-native
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Sentry = require("sentry-expo");
} catch {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Sentry = require("@sentry/react-native");
  } catch {
    // No Sentry available - that's fine
  }
}

export type VerificationStatus = "unverified" | "pending" | "approved" | "rejected";
export type BusinessTier = 1 | 2 | 3 | 4 | 5 | 6;

export interface BusinessProfile {
  tier?: BusinessTier;
  verificationStatus: VerificationStatus;
  businessName?: string;
  businessType?: string;
  selectedPlan?: { name: string; tier: string; price: string };
}

export interface SessionUser {
  id?: string;
  userId?: string;
  email?: string;
  role?:
    | "ADMIN"
    | "SUPER_ADMIN"
    | "CREATOR"
    | "BUSINESS_OWNER"
    | "STAFF"
    | "CUSTOMER";
  accountType?: "consumer" | "business";
  business?: BusinessProfile;
  name?: string;
  phone?: string;
  avatarUrl?: string;
  createdAt?: string;
}

interface SessionContextType {
  token: string | null;
  user: SessionUser | null;
  ready: boolean;
  setAuth: (token: string | null, user?: SessionUser | null) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: SessionUser | null) => void;
  updateBusiness: (updates: Partial<BusinessProfile>) => void;
  logout?: () => Promise<void>; // deprecated
}

// Safe default (throws if used outside provider)
const defaultCtx: SessionContextType = {
  token: null,
  user: null,
  ready: false,
  async setAuth() {
    throw new Error("SessionProvider not mounted");
  },
  async signOut() {
    throw new Error("SessionProvider not mounted");
  },
  setUser() {
    throw new Error("SessionProvider not mounted");
  },
  updateBusiness() {
    throw new Error("SessionProvider not mounted");
  },
};

const SessionContext = createContext<SessionContextType>(defaultCtx);
export const useSession = () => useContext(SessionContext);

// Helper to safely set Sentry user context
function setSentryUser(user: SessionUser | null) {
  if (!Sentry || !user) return;
  
  const sentryUser = {
    id: user.id || user.userId,
    email: user.email,
    role: user.role,
  };

  try {
    // Try different Sentry API patterns
    if (Sentry.Native?.setUser) {
      Sentry.Native.setUser(sentryUser);
    } else if (Sentry.Sentry?.setUser) {
      Sentry.Sentry.setUser(sentryUser);
    } else if (Sentry.setUser) {
      Sentry.setUser(sentryUser);
    }
  } catch (error) {
    console.warn("Failed to set Sentry user context:", error);
  }
}

// Helper to clear Sentry user context
function clearSentryUser() {
  try {
    if (Sentry?.Native?.setUser) {
      Sentry.Native.setUser(null);
    } else if (Sentry?.Sentry?.setUser) {
      Sentry.Sentry.setUser(null);
    } else if (Sentry?.setUser) {
      Sentry.setUser(null);
    }
  } catch (error) {
    console.warn("Failed to clear Sentry user context:", error);
  }
}

interface SessionProviderProps {
  children: React.ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const pathname = usePathname();

  // Enhanced session cleanup helper
  const clearSession = async () => {
    try {
      // 1. Clear stored tokens
      await SecureStore.deleteItemAsync("access_token").catch(() => {});
      await SecureStore.deleteItemAsync("refresh_token").catch(() => {}); // if you store it
      
      // 2. Clear any other auth-related storage keys
      await SecureStore.deleteItemAsync("sessionStartedAt").catch(() => {});
      
      // 3. Clear API client auth headers
      setAuthToken(null);
      
      // 4. Clear in-memory session state
      setToken(null);
      setUser(null);
      
      // 5. Clear Sentry user context
      clearSentryUser();
      
      console.log("✅ Local session cleared");
      
    } catch (error) {
      console.error("❌ Failed to clear session:", error);
      throw error;
    }
  };

  // Update global path tracker whenever route changes
  useEffect(() => {
    if (pathname) {
      setCurrentPath(pathname);
    }
  }, [pathname]);

  // Initial boot: restore token, probe auth, fetch user profile
  useEffect(() => {
    (async () => {
      try {
        const storedToken = await SecureStore.getItemAsync("access_token");
        if (!storedToken) {
          return; // Not signed in
        }

        // Use token for the probe, but DO NOT commit state yet
        setAuthToken(storedToken);

        try {
          // Get refresh token to extract sessionJti
          const { refreshToken } = await getTokens().catch(() => ({ refreshToken: null }));
          const sessionJti = refreshToken ? decodeJwt(refreshToken)?.jti : undefined;

          // 1) Quick heartbeat with session tracking
          const heartbeatResult = await meHeartbeat({
            accessToken: storedToken,
            currentPath: pathname || "/",
            sessionJti, // Now includes the sessionJti parameter
          });

          // 2) Load full profile (includes business data)
          const me = await jsonFetch("/api/users/me", { method: "GET" });

          // Set Sentry user context
          setSentryUser(me);

          // ✅ Only now commit token + full user
          setToken(storedToken);
          setUser(me);

          console.log("✅ Session restored successfully:", me?.email || me?.id);
        } catch (err: any) {
          const status = Number(err?.status || err?.response?.status || 0);
          const codeMsg = `${err?.code || ""} ${err?.message || ""}`;
          
          // Any auth failure (401/expired/invalid) → nuke token
          if (
            status === 401 ||
            /expired/i.test(codeMsg) ||
            /invalid/i.test(codeMsg) ||
            /no[_\s-]?token/i.test(codeMsg)
          ) {
            console.log("🔐 Stored token is invalid, clearing session");
            try {
              await SecureStore.deleteItemAsync("access_token");
            } catch {}
            setAuthToken(null);
          }
          
          // Leave token state null and user null
          setToken(null);
          setUser(null);
        }
      } catch (error) {
        console.error("❌ Session initialization failed:", error);
        // Hard failure → ensure clean state
        try {
          await SecureStore.deleteItemAsync("access_token");
        } catch {}
        setAuthToken(null);
        setToken(null);
        setUser(null);
      } finally {
        setReady(true);
      }
    })();
  }, [pathname]);

  // Per-page session ping: sends X-Path and X-Session, signs out on 401
  useEffect(() => {
    if (!token || !ready) return;
    if (!pathname) return;

    let canceled = false;

    const performSessionPing = async () => {
      try {
        // Get refresh token to extract JTI for session tracking
        const { refreshToken } = await getTokens().catch(() => ({ refreshToken: null }));
        const sessionJti = refreshToken ? decodeJwt(refreshToken)?.jti : null;

        // Ping /api/auth/me with session tracking headers
        await api.get("/api/auth/me", {
          headers: {
            "X-Path": pathname,
            ...(sessionJti && { "X-Session": sessionJti }),
            ...(process.env.EXPO_PUBLIC_APP_VERSION && { 
              "X-App-Build": process.env.EXPO_PUBLIC_APP_VERSION 
            }),
          },
        });

        if (!canceled) {
          console.log(`📍 Session ping successful for ${pathname}`);
        }
      } catch (err: any) {
        if (canceled) return;

        const status = Number(err?.response?.status || err?.status || 0);
        
        if (status === 401) {
          console.log("🚪 Session expired during ping, signing out");
          // Token is no longer valid — sign out immediately
          await clearSession();
        } else {
          // Non-auth errors: don't sign out, just log
          console.warn(`⚠️ Session ping failed for ${pathname}:`, err?.message || err);
        }
      }
    };

    // Debounce rapid route changes
    const timeoutId = setTimeout(performSessionPing, 100);

    return () => {
      canceled = true;
      clearTimeout(timeoutId);
    };
  }, [pathname, token, ready]);

  const setAuth = async (newToken: string | null, newUser?: SessionUser | null) => {
    if (!newToken) {
      await clearSession();
      setReady(true);
      return;
    }

    try {
      await SecureStore.setItemAsync("access_token", newToken);
      setAuthToken(newToken);
      setToken(newToken);
      setUser(newUser ?? null);

      // Set Sentry user context
      setSentryUser(newUser ?? null);

      console.log("✅ Auth set successfully:", newUser?.email || newUser?.id);
    } catch (error) {
      console.error("❌ Failed to set auth:", error);
      await clearSession();
    }

    setReady(true);
  };

  // Enhanced signOut with proper API logout integration
  const signOut = async () => {
    console.log("👋 Signing out...");
    
    try {
      // Get current tokens before clearing
      const accessToken = await SecureStore.getItemAsync("access_token");
      const refreshToken = await SecureStore.getItemAsync("refresh_token"); // if you store it
      
      // 1. Try to revoke server-side refresh tokens (best effort)
      if (accessToken) {
        try {
          await apiLogout(accessToken, { 
            allDevices: true, // revoke all sessions by default
            refreshToken: refreshToken ?? undefined 
          });
          console.log("✅ Server-side logout successful");
        } catch (error) {
          // Don't block logout on server errors - log and continue
          console.warn("⚠️ Server-side logout failed (continuing local cleanup):");
          
          // Optional: capture for monitoring
          if (Sentry?.Native?.captureException) {
            Sentry.Native.captureException(error);
          }
        }
      }

      // 2. Always clear local session data (even if server logout failed)
      await clearSession();
      
      console.log("✅ Signed out successfully");
      
    } catch (error) {
      // Final catch-all: ensure we always clear local state
      console.error("❌ Logout error, forcing local cleanup:", error);
      
      try {
        await clearSession();
      } catch (cleanupError) {
        console.error("❌ Failed to clear session:", cleanupError);
      }
      
      // Optional: capture for monitoring
      if (Sentry?.Native?.captureException) {
        Sentry.Native.captureException(error);
      }
    } finally {
      setReady(true);
    }
  };

  const updateBusiness = (updates: Partial<BusinessProfile>) => {
    setUser((prev) =>
      prev
        ? {
            ...prev,
            business: {
              ...(prev.business || { verificationStatus: "unverified" }),
              ...updates,
            },
          }
        : prev
    );
  };

  const value: SessionContextType = {
    token,
    user,
    ready,
    setAuth,
    signOut,
    setUser,
    updateBusiness,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}