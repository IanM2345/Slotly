import type { BusinessTier, TierFeatures } from "./types"

export const FEATURE_MATRIX: Record<BusinessTier, TierFeatures> = {
  level1: {
    analytics: false,
    multiStaff: false,
    multiLocation: false,
    reports: false,
    advancedBooking: false,
    canUseCoupons: false,     // ← add
  },
  level2: {
    analytics: false,
    multiStaff: true,
    multiLocation: false,
    reports: false,
    advancedBooking: false,
    canUseCoupons: true,      // ← add
  },
  level3: {
    analytics: true,
    multiStaff: true,
    multiLocation: false,
    reports: true,
    advancedBooking: true,
    canUseCoupons: true,      // ← add
  },
  level4: {
    analytics: true,
    multiStaff: true,
    multiLocation: true,
    reports: true,
    advancedBooking: true,
    canUseCoupons: true,      // ← add
  },
  level5: {
    analytics: true,
    multiStaff: true,
    multiLocation: true,
    reports: true,
    advancedBooking: true,
    canUseCoupons: true,      // ← add
  },
  level6: {
    analytics: true,
    multiStaff: true,
    multiLocation: true,
    reports: true,
    advancedBooking: true,
    canUseCoupons: true,      // ← add
  },
}
