// apps/mobile/lib/api/modules/promo.js
import { jsonFetch } from "./_fetch";

/**
 * Link an already-redeemed promo code (with null businessId) to a new business
 * This is Step 3 of the multi-endpoint onboarding flow
 * @param {Object} params - Promo linking data
 * @param {string} params.code - Promo code
 * @param {string} params.businessId - Business ID to link to
 * @param {string} params.plan - Plan tier (optional)
 * @param {string} params.trialEndsOn - Trial end date (optional)
 * @param {string} token - Auth token
 */
export function linkPromo({ code, businessId, plan, trialEndsOn }, token) {
  return jsonFetch("/api/promo/link", {
    method: "POST",
    body: { code, businessId, plan, trialEndsOn },
    token,
  });
}

/**
 * Get promo redemptions for current user
 * @param {Object} params - Query parameters
 * @param {string} params.businessId - Filter by business ID (optional)
 * @param {string} params.code - Filter by specific code (optional)
 * @param {string} token - Auth token
 */
export function getPromoRedemptions({ businessId, code } = {}, token) {
  const params = new URLSearchParams();
  if (businessId) params.set('businessId', businessId);
  if (code) params.set('code', code);
  
  const queryString = params.toString();
  return jsonFetch(`/api/promo/link${queryString ? `?${queryString}` : ''}`, {
    token,
  });
}

/**
 * Validate promo code (check if it exists and is available for user)
 * @param {string} code - Promo code to validate
 * @param {string} token - Auth token
 */
export function validatePromoCode(code, token) {
  return jsonFetch("/api/promo/validate", {
    method: "POST",
    body: { code },
    token,
  });
}

/**
 * Redeem a promo code (creates initial redemption with null businessId)
 * This should be called before business creation
 * @param {Object} params - Redemption data
 * @param {string} params.code - Promo code
 * @param {string} params.plan - Plan tier (optional)
 * @param {string} token - Auth token
 */
export function redeemPromoCode({ code, plan }, token) {
  return jsonFetch("/api/promo/redeem", {
    method: "POST",
    body: { code, plan },
    token,
  });
}

/**
 * Check if user has any unlinked promo redemptions
 * @param {string} token - Auth token
 */
export async function getUnlinkedPromoRedemptions(token) {
  try {
    const redemptions = await getPromoRedemptions({}, token);
    // Filter redemptions that don't have a businessId (unlinked)
    return redemptions.filter(redemption => !redemption.businessId);
  } catch (error) {
    console.warn("Failed to fetch unlinked promo redemptions:", error);
    return [];
  }
}

/**
 * Get promo details by code (public endpoint, no auth required)
 * @param {string} code - Promo code
 */
export function getPromoDetails(code) {
  return jsonFetch(`/api/promo/${code}`);
}