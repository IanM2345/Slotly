"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type VerificationStatus = "unverified" | "pending" | "approved" | "rejected";
export type BusinessTier = 1 | 2 | 3 | 4 | 5 | 6;

export interface BusinessProfile {
  tier?: BusinessTier;
  verificationStatus: VerificationStatus;
  businessName?: string;
  businessType?: string;
  selectedPlan?: {
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
}

interface SessionContextType {
  user: SessionUser | null;
  setUser: (user: SessionUser | null) => void;
  updateBusiness: (updates: Partial<BusinessProfile>) => void;
}

/** Export the context so screens can consume it directly if needed */
export const SessionContext = createContext<SessionContextType | undefined>(undefined);

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  // Dev default: logged-in business with a visible userId
  const [user, setUser] = useState<SessionUser | null>({
    id: "dev-1",
    userId: "u1001",
    accountType: "consumer",
    email: "test@example.com",
    business: {
      tier: 2,
      verificationStatus: "unverified",
    },
  });

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

  const value: SessionContextType = {
    user,
    setUser,
    updateBusiness,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** Preferred consumer hook */
export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
