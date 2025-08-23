"use client";
"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { createContext, useContext, useState, type ReactNode } from "react";
import { setAuthToken } from "../lib/api/client";

export type VerificationStatus = "unverified" | "pending" | "approved" | "rejected";
export type BusinessTier = 1 | 2 | 3 | 4 | 5 | 6;
export type VerificationStatus = "unverified" | "pending" | "approved" | "rejected";
export type BusinessTier = 1 | 2 | 3 | 4 | 5 | 6;

export interface BusinessProfile {
  tier?: BusinessTier;
  verificationStatus: VerificationStatus;
  businessName?: string;
  businessType?: string;
  tier?: BusinessTier;
  verificationStatus: VerificationStatus;
  businessName?: string;
  businessType?: string;
  selectedPlan?: {
    name: string;
    tier: string;
    price: string;
  };
    name: string;
    tier: string;
    price: string;
  };
}

export interface SessionUser {
  /** Optional internal id from backend (if present) */
  id?: string;

  /** Public-facing Slotly User ID shown on profile screens */
  userId?: string;

  accountType: "consumer" | "business" | "staff";
  email?: string;
  business?: BusinessProfile;
  id?: string;
  email?: string;
  role?: "CUSTOMER" | "BUSINESS_OWNER" | "ADMIN";
  accountType?: "consumer" | "business";
  business?: BusinessProfile;
}

interface SessionContextType {
  user: SessionUser | null;
  setUser: (user: SessionUser | null) => void;
  updateBusiness: (updates: Partial<BusinessProfile>) => void;
  user: SessionUser | null;
  token: string | null;
  setAuth: (token: string | null, user?: Partial<SessionUser>) => void;
  setUser: (user: SessionUser | null) => void;
  updateBusiness: (updates: Partial<BusinessProfile>) => void;
}

/** Export the context so screens can consume it directly if needed */
export const SessionContext = createContext<SessionContextType | undefined>(undefined);
const SessionContext = createContext<SessionContextType | undefined>(undefined);

interface SessionProviderProps {
  children: ReactNode;
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  // Dev default: logged-in business with a visible userId
  const [user, setUser] = useState<SessionUser | null>({
    id: "dev-1",
    userId: "u1001",
    accountType: "business",
    email: "test@example.com",
    business: {
      tier: 2,
      verificationStatus: "unverified",
    },
  });
  const [user, setUser] = useState<SessionUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const setAuth = (t: string | null, u?: Partial<SessionUser>) => {
    setToken(t);
    
    // Set axios Authorization header with error handling
    try {
      setAuthToken(t);
    } catch (error) {
      console.warn("Failed to set auth token:", error);
    }
    
    if (u) {
      setUser((prev) => ({ ...(prev || {}), ...u }));
    }
  };

  const updateBusiness = (updates: Partial<BusinessProfile>) => {
    if (user?.business) {
      setUser({
        ...user,
        business: {
          ...user.business,
          ...updates,
        },
      });
    }
  };
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
    user,
    token,
    setAuth,
    setUser,
    updateBusiness,
  };
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

/** Preferred consumer hook */
export function useSession() {
  const context = useContext(SessionContext);
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider");
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
  return context;
}