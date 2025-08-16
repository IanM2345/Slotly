
import api from "../../api/client";

/**
 * Search businesses
 * GET /search?q=&lat=&lng=&date=&dayPart=
 */
export async function search({ q, lat, lng, date, dayPart }) {
  const { data } = await api.get("/search", {
    params: { q, lat, lng, date, dayPart },
  });
  return data;
}

/**
 * Get a single business by id
 * GET /businesses/:id
 * (Assumes a GET handler exists server-side)
 */
export async function getBusiness(id) {
  const { data } = await api.get(`/businesses/${id}`);
  return data;
}

/**
 * Get all businesses (includes relations on the backend)
 * GET /businesses
 */
export async function getAllBusinesses() {
  const { data } = await api.get("/businesses");
  return data;
}

/**
 * Create a basic business (admin-style simple create)
 * POST /businesses
 * body: { name, description, ownerId }
 */
export async function createBusiness(payload) {
  const { data } = await api.post("/businesses", payload);
  return data;
}

/**
 * Register a business (owner self-service flow with verification)
 * POST /businesses/register
 * body: {
 *   name, description?, address, latitude, longitude, type,
 *   idNumber, licenseUrl?, regNumber?, idPhotoUrl, selfieWithIdUrl?,
 *   contactInfo?: { account_bank?, account_number?, business_email? }
 * }
 */
export async function registerBusiness(payload) {
  const { data } = await api.post("/businesses/register", payload);
  return data;
}

/**
 * Update business (name/description)
 * PUT /businesses/:id
 * body: { name?, description? }
 */
export async function updateBusiness(id, payload) {
  const { data } = await api.put(`/businesses/${id}`, payload);
  return data;
}

/**
 * Delete business
 * DELETE /businesses/:id
 */
export async function deleteBusiness(id) {
  const { data } = await api.delete(`/businesses/${id}`);
  return data;
}
