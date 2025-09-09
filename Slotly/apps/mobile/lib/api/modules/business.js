// apps/mobile/lib/api/modules/business.js
import { jsonFetch, formDataFetch } from "./_fetch";

// Simple in-memory cache with TTL
const _bizCache = new Map(); // id -> { v, t }
const TTL = 5 * 60 * 1000; // 5 minutes

export async function getBusiness(id, opts = {}) {
  if (!id) throw new Error('id required');
  
  // Check cache first
  const now = Date.now();
  const cached = _bizCache.get(id);
  if (cached && now - cached.t < TTL) return cached.v;

  // Fetch and cache
  const data = await jsonFetch(`/api/businesses/${id}`, { method: 'GET', ...opts });
  _bizCache.set(id, { v: data, t: now });
  return data;
}

export function prefetchBusiness(id) {
  if (!id) return;
  getBusiness(id).catch(() => {}); // Fire and forget
}

/**
 * @typedef {Object} CreateBusinessVerificationPayload
 * @property {string} businessId
 * @property {"FORMAL"|"INFORMAL"} type
 * @property {string} idNumber
 * @property {string} idPhotoUrl
 * @property {string=} selfieWithIdUrl
 * @property {string|null=} regNumber
 * @property {string|null=} licenseUrl
 */

// ================== Services endpoints ==================

/**
 * Get a single service by ID (includes business)
 * @param {string} id - Service ID
 */
export function getServiceById(id) {
  if (!id) throw new Error("getServiceById requires an id");
  return jsonFetch(`/api/services/${encodeURIComponent(id)}`);
}

// ================== Business onboarding flow ==================

/**
 * Create a new business (owner is inferred from the token)
 * @param {Object} payload - Business data
 * @param {string} token - Auth token
 */
export function createBusiness(payload, token) {
  return jsonFetch("/api/businesses", {
    method: "POST",
    body: payload,
    token,
  });
}

/**
 * Create business verification record
 * @param {CreateBusinessVerificationPayload} payload - Verification payload
 * @param {string} token - Auth token
 */
export function createBusinessVerification(payload, token) {
  if (!payload.businessId) throw new Error("businessId is required");
  
  const { businessId, ...rest } = payload;
  return jsonFetch(`/api/businesses/${encodeURIComponent(businessId)}/verification`, {
    method: "POST",
    body: rest,
    token,
  });
}

/**
 * Get business verification status
 * @param {string} token - Auth token
 * @param {string} businessId - Business ID (optional)
 */
export function getVerification(token, businessId) {
  const path = businessId
    ? `/api/businesses/${encodeURIComponent(businessId)}/verification`
    : "/api/manager/business/verification";
  return jsonFetch(path, {
    method: "GET",
    token,
  });
}

/**
 * Get current user's latest business verification (by session token)
 * @param {string} token - Auth token
 */
export function getMyLatestVerification(token) {
  return jsonFetch("/api/businesses/verification/latest", { 
    method: "GET",
    token,
  });
}

// ================== Public endpoints (no auth required) ==================

/**
 * Search businesses with filters
 * @param {Object} params - Search parameters
 * @param {string} params.q - Search query
 * @param {number} params.lat - Latitude
 * @param {number} params.lng - Longitude  
 * @param {string} params.date - Date filter
 * @param {string} params.dayPart - Day part filter
 */
export async function search({ q, lat, lng, date, dayPart }) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (lat) params.set('lat', String(lat));
  if (lng) params.set('lng', String(lng));
  if (date) params.set('date', date);
  if (dayPart) params.set('dayPart', dayPart);
  
  return jsonFetch(`/api/search?${params.toString()}`);
}

/**
 * Get all businesses (public listing)
 */
export async function getAllBusinesses() {
  return jsonFetch("/api/businesses");
}

// ================== Reviews (public) ==================
export async function getBusinessReviewSummary(businessId) {
  if (!businessId) throw new Error("businessId required");
  const params = new URLSearchParams({ businessId, limit: "0" });
  return jsonFetch(`/api/businesses/reviews?${params.toString()}`); // returns avg, count
}

export async function getBusinessReviews(businessId, { page = 1, limit = 3 } = {}) {
  if (!businessId) throw new Error("businessId required");
  const params = new URLSearchParams({ businessId, page: String(page), limit: String(limit) });
  return jsonFetch(`/api/businesses/reviews?${params.toString()}`);
}

// ================== Manager endpoints (authenticated) ==================

/**
 * Get current user's business details
 * @param {string} token - Auth token
 */
export async function getMyBusiness(token) {
  // Use the existing endpoint that you DO have
  const me = await jsonFetch("/api/users/me", { token });
// Normalize to the shape your callers expect
 if (!me?.business) return { business: null };
 return { business: me.business };
}

/**
 * Update current user's business
 * @param {Object} payload - Updated business data
 * @param {string} token - Auth token
 */
export async function updateMyBusiness(payload, token) {
  return jsonFetch("/api/manager/business", {
    method: "PUT",
    body: payload,
    token,
  });
}

/**
 * Delete current user's business
 * @param {string} token - Auth token
 */
export async function deleteMyBusiness(token) {
  return jsonFetch("/api/manager/business", {
    method: "DELETE",
    token,
  });
}

/**
 * Get business analytics/stats for current user's business
 * @param {string} token - Auth token
 */
export async function getMyBusinessAnalytics(token) {
  return jsonFetch("/api/manager/business/analytics", {
    token,
  });
}

/**
 * Update business status for current user's business
 * @param {Object} status - Status update (e.g., { isOpen: true, currentCapacity: 50 })
 * @param {string} token - Auth token
 */
export async function updateMyBusinessStatus(status, token) {
  return jsonFetch("/api/manager/business/status", {
    method: "PATCH",
    body: status,
    token,
  });
}

// ================== Business media endpoints ==================

/**
 * Upload business images for current user's business
 * @param {FormData} formData - Image files
 * @param {string} token - Auth token
 */
export async function uploadMyBusinessImages(formData, token) {
  return formDataFetch("/api/manager/business/images", formData, token);
}

/**
 * Delete business image from current user's business
 * @param {string} imageId - Image ID
 * @param {string} token - Auth token
 */
export async function deleteMyBusinessImage(imageId, token) {
  return jsonFetch(`/api/manager/business/images/${imageId}`, {
    method: "DELETE",
    token,
  });
}

// ================== Business hours endpoints ==================

/**
 * Update business hours for current user's business
 * @param {Object} hours - Business hours data
 * @param {string} token - Auth token
 */
export async function updateMyBusinessHours(hours, token) {
  return jsonFetch("/api/manager/business/hours", {
    method: "PUT",
    body: hours,
    token,
  });
}

/**
 * Get business availability for date range for current user's business
 * @param {string} startDate - Start date
 * @param {string} endDate - End date
 * @param {string} token - Auth token
 */
export async function getMyBusinessAvailability(startDate, endDate, token) {
  const params = new URLSearchParams({ startDate, endDate });
  return jsonFetch(`/api/manager/business/availability?${params.toString()}`, {
    token,
  });
}

// ================== Legacy endpoints (kept for backwards compatibility) ==================

/**
 * @deprecated Use getMyBusiness instead
 * Get businesses owned by current user (requires authentication)
 * @param {string} token - Auth token
 */


/**
 * @deprecated Use updateMyBusiness instead
 * Update an existing business (requires authentication & ownership)
 * @param {string} id - Business ID
 * @param {Object} payload - Updated business data
 * @param {string} token - Auth token
 */
export async function updateBusiness(id, payload, token) {
  return jsonFetch(`/api/businesses/${id}`, {
    method: "PUT",
    body: payload,
    token,
  });
}

/**
 * @deprecated Use deleteMyBusiness instead
 * Delete a business (requires authentication & ownership)
 * @param {string} id - Business ID
 * @param {string} token - Auth token
 */
export async function deleteBusiness(id, token) {
  return jsonFetch(`/api/businesses/${id}`, {
    method: "DELETE",
    token,
  });
}