// apps/mobile/lib/api/modules/services.js
import api from "../client";

// Simple in-memory cache with TTL
const _svcCache = new Map(); // businessId -> { v, t }
const TTL = 5 * 60 * 1000; // 5 minutes

export async function listServicesForBusiness({ businessId }, opts = {}) {
  if (!businessId) throw new Error('businessId required');
  
  // Check cache first
  const now = Date.now();
  const cached = _svcCache.get(businessId);
  if (cached && now - cached.t < TTL) return cached.v;

  // Fetch and cache
  const { data } = await api.get("/api/services", { params: { businessId } });
  const arr = Array.isArray(data) ? data : (data?.services ?? []);
  _svcCache.set(businessId, { v: arr, t: now });
  return arr;
}

export function prefetchServicesForBusiness(businessId) {
  if (!businessId) return;
  listServicesForBusiness({ businessId }).catch(() => {}); // Fire and forget
}

/**
 * Get a single service by id.
 * Backend: GET /api/services/:id
 */
export async function getService(id) {
  if (!id) throw new Error("getService: 'id' is required.");
  const { data } = await api.get(`/api/services/${encodeURIComponent(id)}`);
  return data;
}

/**
 * Create service.
 * Backend: POST /api/services
 */
export async function createService(payload) {
  const { data } = await api.post("/api/services", payload);
  return data;
}

/**
 * Update service (requires STAFF role; user must belong to the business).
 * Backend: PUT /api/services/:id
 */
export async function updateService(id, updates, { userId, role = "STAFF" } = {}) {
  if (!id) throw new Error("updateService: 'id' is required.");
  if (!userId) throw new Error("updateService: 'userId' is required for authorization.");
  const { data } = await api.put(`/api/services/${encodeURIComponent(id)}`, updates, {
    headers: { "x-user-role": role, "x-user-id": userId },
  });
  return data;
}

/**
 * Delete service (requires STAFF role; user must belong to the business).
 * Backend: DELETE /api/services/:id
 */
export async function deleteService(id, { userId, role = "STAFF" } = {}) {
  if (!id) throw new Error("deleteService: 'id' is required.");
  if (!userId) throw new Error("deleteService: 'userId' is required for authorization.");
  const { data } = await api.delete(`/api/services/${encodeURIComponent(id)}`, {
    headers: { "x-user-role": role, "x-user-id": userId },
  });
  return data;
}

// Legacy function name for backwards compatibility
export async function listServices({ businessId } = {}) {
  return listServicesForBusiness({ businessId });
}