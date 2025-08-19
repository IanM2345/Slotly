// ---------- Plans & features ----------
export const PLAN_FEATURES = {
  LEVEL_1: {
    name: 'Individual / Solopreneur',
    monthlyPriceKES: 0,
    maxStaff: 1,
    maxServices: 3,
    canUseCoupons: false,
    canUseBundles: false,
    canUseZoho: false,
    canAccessReports: false,
    canUseAnalytics: false,
    smsCredits: 0,
    brandedBookingPage: false,
  },
  LEVEL_2: {
    name: 'Micro-Business',
    monthlyPriceKES: 999,
    maxStaff: 2,
    maxServices: 5,
    canUseCoupons: true,
    canUseBundles: true,
    canUseZoho: false,
    canAccessReports: false,
    canUseAnalytics: false,
    smsCredits: 50,
    brandedBookingPage: false,
  },
  LEVEL_3: {
    name: 'SME / Teams',
    monthlyPriceKES: 2999,
    maxStaff: 5,
    maxServices: 10,
    canUseCoupons: true,
    canUseBundles: true,
    canUseZoho: true,
    canAccessReports: true,
    canUseAnalytics: true,
    smsCredits: 100,
    brandedBookingPage: true,
  },
  LEVEL_4: {
    name: 'Business Chain / Branches',
    monthlyPriceKES: 6999,
    maxStaff: 20,
    maxServices: 30,
    canUseCoupons: true,
    canUseBundles: true,
    canUseZoho: true,
    canAccessReports: true,
    canUseAnalytics: true,
    smsCredits: 300,
    brandedBookingPage: true,
  },
  LEVEL_5: {
    name: 'Institutions / NGOs',
    monthlyPriceKES: 14999,
    maxStaff: 50,
    maxServices: 50,
    canUseCoupons: true,
    canUseBundles: true,
    canUseZoho: true,
    canAccessReports: true,
    canUseAnalytics: true,
    smsCredits: 500,
    brandedBookingPage: true,
  },
  LEVEL_6: {
    name: 'Government & Enterprise',
    monthlyPriceKES: 30000,
    maxStaff: 100,
    maxServices: 100,
    canUseCoupons: true,
    canUseBundles: true,
    canUseZoho: true,
    canAccessReports: true,
    canUseAnalytics: true,
    smsCredits: 1000,
    brandedBookingPage: true,
  },
};

// Canonical plan ids to avoid typos across the app/db
export const SubscriptionPlan = Object.freeze({
  LEVEL_1: 'LEVEL_1',
  LEVEL_2: 'LEVEL_2',
  LEVEL_3: 'LEVEL_3',
  LEVEL_4: 'LEVEL_4',
  LEVEL_5: 'LEVEL_5',
  LEVEL_6: 'LEVEL_6',
});

// Feature helpers / limits by plan
export const serviceLimitByPlan = {
  LEVEL_1: 1,
  LEVEL_2: 5,
  LEVEL_3: 15,
  LEVEL_4: 50,
  LEVEL_5: 100,
  LEVEL_6: 200,
};

export const staffLimitByPlan = {
  LEVEL_1: 1,
  LEVEL_2: 3,
  LEVEL_3: 10,
  LEVEL_4: 30,
  LEVEL_5: 50,
  LEVEL_6: 100,
};

export const couponAccessByPlan = {
  LEVEL_1: false,
  LEVEL_2: true,
  LEVEL_3: true,
  LEVEL_4: true,
  LEVEL_5: true,
  LEVEL_6: true,
};

// Primary API: returns the feature object for a given plan
export function getPlanFeatures(plan) {
  // ensure we return a valid plan feature object even if plan is null/unknown
  return PLAN_FEATURES?.[plan] ?? PLAN_FEATURES[SubscriptionPlan.LEVEL_1];
}

// Optional default export (useful if someone imports default)
export default {
  PLAN_FEATURES,
  SubscriptionPlan,
  getPlanFeatures,
  serviceLimitByPlan,
  staffLimitByPlan,
  couponAccessByPlan,
};
