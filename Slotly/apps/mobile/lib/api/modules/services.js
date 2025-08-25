// apps/mobile/lib/api/modules/services.js
import api from "../client";

/**
 * List services for a business.
 * Backend: GET /api/services?businessId=...
 */
export async function listServicesForBusiness({ businessId } = {}) {
  if (!businessId) throw new Error("listServicesForBusiness: 'businessId' is required.");
  const { data } = await api.get("/api/services", { params: { businessId } });
  return data;
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