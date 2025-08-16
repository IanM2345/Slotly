
import api from "../../api/client";

/**
 * List services for a business.
 * Backend: GET /services?businessId=...
 */
export async function listServices({ businessId } = {}) {
  if (!businessId) throw new Error("listServices: 'businessId' is required.");
  const { data } = await api.get("/services", { params: { businessId } });
  return data;
}

/**
 * Get a single service by id.
 * Since backend has no GET /services/:id, we fetch the business' list and find it.
 */
export async function getService(id, { businessId } = {}) {
  if (!id) throw new Error("getService: 'id' is required.");
  if (!businessId) {
    throw new Error("getService: 'businessId' is required (no GET /services/:id on backend).");
  }
  const services = await listServices({ businessId });
  const service = services.find((s) => s.id === id);
  if (!service) {
    const e = new Error("Service not found");
    e.code = "NOT_FOUND";
    throw e;
  }
  return service;
}

/**
 * Create service.
 * Backend: POST /services
 */
export async function createService(payload) {
  const { data } = await api.post("/services", payload);
  return data;
}

/**
 * Update service (requires STAFF role; user must belong to the business).
 * Backend: PUT /services/:id
 */
export async function updateService(id, updates, { userId, role = "STAFF" } = {}) {
  if (!id) throw new Error("updateService: 'id' is required.");
  if (!userId) throw new Error("updateService: 'userId' is required for authorization.");
  const { data } = await api.put(`/services/${id}`, updates, {
    headers: { "x-user-role": role, "x-user-id": userId },
  });
  return data;
}

/**
 * Delete service (requires STAFF role; user must belong to the business).
 * Backend: DELETE /services/:id
 */
export async function deleteService(id, { userId, role = "STAFF" } = {}) {
  if (!id) throw new Error("deleteService: 'id' is required.");
  if (!userId) throw new Error("deleteService: 'userId' is required for authorization.");
  const { data } = await api.delete(`/services/${id}`, {
    headers: { "x-user-role": role, "x-user-id": userId },
  });
  return data;
}
