
import api from "../../api/client";

/**
 * Create a booking (CUSTOMER only)
 * Backend: POST /api/bookings
 * Body: { businessId, serviceId, startTime, couponCode? }
 */
export async function createBooking(payload) {
  // payload = { businessId, serviceId, startTime, couponCode? }
  const { data } = await api.post("/bookings", payload);
  return data; // { booking, discountApplied }
}

/**
 * List bookings
 * Backend: GET /api/bookings
 * - CUSTOMER → returns only their own
 * - STAFF/BUSINESS_OWNER → may pass { businessId } to filter
 */
export async function listBookings(params = {}) {
  // params = { businessId? }
  const { data } = await api.get("/bookings", {
    params: params.businessId ? { businessId: params.businessId } : undefined,
  });
  return data; // Booking[]
}

/**
 * Update a booking (STAFF only)
 * Backend: PUT /api/bookings/:id
 * Body: { startTime?, serviceId? }
 */
export async function updateBooking(bookingId, payload) {
  const { data } = await api.put(`/bookings/${bookingId}`, payload);
  return data; // Booking
}

/**
 * Delete a booking (STAFF only)
 * Backend: DELETE /api/bookings/:id
 */
export async function deleteBooking(bookingId) {
  const { data } = await api.delete(`/bookings/${bookingId}`);
  return data; // { message: 'Booking deleted' }
}

/**
 * Not supported by current backend:
 * There is no GET /api/bookings/:id route implemented.
 * If you add a GET handler on the backend, you can switch this to a real call.
 */
export async function getBooking(/* id */) {
  throw new Error("getBooking is not supported: backend lacks GET /api/bookings/:id");
}

/**
 * Not supported by current backend:
 * There is no POST /users/bookings/:id/cancel route.
 * Use deleteBooking(id) for STAFF deletes, or add a cancel endpoint on the backend.
 */
export async function cancelBooking(bookingId) {
  const { data } = await api.post(`/users/bookings/${bookingId}/cancel`);
  return data;
}

