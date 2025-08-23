import type { BusinessTier, TierFeatures } from "./types"

export const TIER_NAMES: Record<BusinessTier, string> = {
  level1: "Starter",
  level2: "Basic", 
  level3: "Pro",
  level4: "Business",
  level5: "Enterprise",
  level6: "Premium",
};

export const FEATURE_MATRIX: Record<BusinessTier, TierFeatures> = {
  level1: {
    analytics: false,
    multiStaff: false,
    multiLocation: false,
    reports: false,
    advancedBooking: false,
    canUseCoupons: false,
  },
  level2: {
    analytics: false,
    multiStaff: true,
    multiLocation: false,
    reports: false,
    advancedBooking: false,
    canUseCoupons: true,
  },
  level3: {
    analytics: true,
    multiStaff: true,
    multiLocation: false,
    reports: true,
    advancedBooking: true,
    canUseCoupons: true,
  },
  level4: {
    analytics: true,
    multiStaff: true,
    multiLocation: true,
    reports: true,
    advancedBooking: true,
    canUseCoupons: true,
  },
  level5: {
    analytics: true,
    multiStaff: true,
    multiLocation: true,
    reports: true,
    advancedBooking: true,
    canUseCoupons: true,
  },
  level6: {
    analytics: true,
    multiStaff: true,
    multiLocation: true,
    reports: true,
    advancedBooking: true,
    canUseCoupons: true,
  },
}