// shared/subscriptionPlanUtils.js

export function getPlanFeatures(plan) {
  const key = String(plan ?? 'FREE').trim().toUpperCase(); // ✅ Added trim()

  // Generic LEVEL_N parser
  const m = key.match(/^LEVEL_(\d+)$/);
  if (m) {
    const lvl = parseInt(m[1], 10);

    // Define features by level - scale capabilities with level
    const byLevel = {
      1: { 
        name: 'Individual / Solopreneur',
        monthlyPriceKES: 0,
        canUseBundles: false, 
        maxBundles: 0,  
        maxServices: 3,
        maxStaff: 1,
        canUseCoupons: false,
        canUseZoho: false,
        canAccessReports: false,
        canUseAnalytics: false,
        smsCredits: 0,
        brandedBookingPage: false,
      },
      2: { 
        name: 'Micro-Business',
        monthlyPriceKES: 999,
        canUseBundles: true,  
        maxBundles: 5,  
        maxServices: 5,
        maxStaff: 2,
        canUseCoupons: true,
        canUseZoho: false,
        canAccessReports: false,
        canUseAnalytics: false,
        smsCredits: 50,
        brandedBookingPage: false,
      },
      3: { 
        name: 'SME / Teams',
        monthlyPriceKES: 2999,
        canUseBundles: true, 
        maxBundles: 10, 
        maxServices: 10,
        maxStaff: 5,
        canUseCoupons: true,
        canUseZoho: true,
        canAccessReports: true,
        canUseAnalytics: true,
        smsCredits: 100,
        brandedBookingPage: true,
      },
      4: { 
        name: 'Business Chain / Branches',
        monthlyPriceKES: 6999,
        canUseBundles: true, 
        maxBundles: 25, 
        maxServices: 30,
        maxStaff: 20,
        canUseCoupons: true,
        canUseZoho: true,
        canAccessReports: true,
        canUseAnalytics: true,
        smsCredits: 300,
        brandedBookingPage: true,
      },
      5: { 
        name: 'Institutions / NGOs',
        monthlyPriceKES: 14999,
        canUseBundles: true, 
        maxBundles: 50, 
        maxServices: 50,
        maxStaff: 50,
        canUseCoupons: true,
        canUseZoho: true,
        canAccessReports: true,
        canUseAnalytics: true,
        smsCredits: 500,
        brandedBookingPage: true,
      },
      6: { 
        name: 'Government & Enterprise',
        monthlyPriceKES: 30000,
        canUseBundles: true, 
        maxBundles: 200, 
        maxServices: 100,
        maxStaff: 100,
        canUseCoupons: true,
        canUseZoho: true,
        canAccessReports: true,
        canUseAnalytics: true,
        smsCredits: 1000,
        brandedBookingPage: true,
      },
    };

    // Clamp to highest defined level or use level 6 features for higher levels
    const top = Math.max(...Object.keys(byLevel).map(Number));
    return byLevel[Math.min(lvl, top)] || byLevel[top];
  }

  // Named plans (fallbacks for legacy or special cases)
  const table = {
    FREE: { 
      name: 'Free',
      monthlyPriceKES: 0,
      canUseBundles: false, 
      maxBundles: 0,  
      maxServices: 3,
      maxStaff: 1,
      canUseCoupons: false,
      canUseZoho: false,
      canAccessReports: false,
      canUseAnalytics: false,
      smsCredits: 0,
      brandedBookingPage: false,
    },
    PRO: { 
      name: 'Pro',
      monthlyPriceKES: 5000,
      canUseBundles: true,  
      maxBundles: 50, 
      maxServices: 100,
      maxStaff: 25,
      canUseCoupons: true,
      canUseZoho: true,
      canAccessReports: true,
      canUseAnalytics: true,
      smsCredits: 200,
      brandedBookingPage: true,
    },
  };

  return table[key] ?? table.FREE;
}

// Maintain backward compatibility with existing code
export const PLAN_FEATURES = {
  LEVEL_1: getPlanFeatures('LEVEL_1'),
  LEVEL_2: getPlanFeatures('LEVEL_2'),
  LEVEL_3: getPlanFeatures('LEVEL_3'),
  LEVEL_4: getPlanFeatures('LEVEL_4'),
  LEVEL_5: getPlanFeatures('LEVEL_5'),
  LEVEL_6: getPlanFeatures('LEVEL_6'),
};

export const SubscriptionPlan = Object.freeze({
  LEVEL_1: 'LEVEL_1',
  LEVEL_2: 'LEVEL_2',
  LEVEL_3: 'LEVEL_3',
  LEVEL_4: 'LEVEL_4',
  LEVEL_5: 'LEVEL_5',
  LEVEL_6: 'LEVEL_6',
});

// Legacy helper maps (for backward compatibility)
export const serviceLimitByPlan = Object.fromEntries(
  Object.keys(PLAN_FEATURES).map(plan => [plan, getPlanFeatures(plan).maxServices])
);

export const staffLimitByPlan = Object.fromEntries(
  Object.keys(PLAN_FEATURES).map(plan => [plan, getPlanFeatures(plan).maxStaff])
);

export const couponAccessByPlan = Object.fromEntries(
  Object.keys(PLAN_FEATURES).map(plan => [plan, getPlanFeatures(plan).canUseCoupons])
);

export default {
  PLAN_FEATURES,
  SubscriptionPlan,
  getPlanFeatures,
  serviceLimitByPlan,
  staffLimitByPlan,
  couponAccessByPlan,
};