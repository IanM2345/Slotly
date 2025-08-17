"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import type { BusinessTier, TierFeatures } from "../lib/types"
import { FEATURE_MATRIX, TIER_NAMES } from "../lib/featureMatrix"

interface TierContextType {
  tier: BusinessTier
  tierName: string
  features: TierFeatures
  setTier: (tier: BusinessTier) => void
}

const TierContext = createContext<TierContextType | undefined>(undefined)

interface TierProviderProps {
  children: ReactNode
  initialTier?: BusinessTier
}

export function TierProvider({ children, initialTier = "level2" }: TierProviderProps) {
  const [tier, setTier] = useState<BusinessTier>(initialTier)

  const value: TierContextType = {
    tier,
    tierName: TIER_NAMES[tier],
    features: FEATURE_MATRIX[tier],
    setTier,
  }

  return <TierContext.Provider value={value}>{children}</TierContext.Provider>
}

export function useTier() {
  const context = useContext(TierContext)
  if (context === undefined) {
    throw new Error("useTier must be used within a TierProvider")
  }
  return context
}
