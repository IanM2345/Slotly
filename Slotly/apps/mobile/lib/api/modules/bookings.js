// apps/mobile/lib/api/modules/bookings.js
import api from "../../api/client";

/** CUSTOMER create booking */
export async function createBooking(payload) {
  // POST /api/bookings
  const { data } = await api.post("/api/bookings", payload);
  return data; // { booking, discountApplied }
}

/** List bookings (manager or customer) */
export async function listBookings(params = {}) {
  // If you want manager context, call /api/manager/bookings
  if (params.businessId) {
    const { data } = await api.get("/api/manager/bookings", { params: { businessId: params.businessId } });
    return Array.isArray(data) ? data : (data.bookings ?? []);
  }
  const { data } = await api.get("/api/bookings");
  return Array.isArray(data) ? data : (data.bookings ?? []);
}

/** Update (staff) */
export async function updateBooking(bookingId, payload) {
  const { data } = await api.put(`/api/bookings/${bookingId}`, payload);
  return data;
}

/** Delete (staff) */
export async function deleteBooking(bookingId) {
  const { data } = await api.delete(`/api/bookings/${bookingId}`);
  return data;
}

/** Optional alias used by some screens */
export async function getBookings(businessId) {
  return listBookings(businessId ? { businessId } : {});
}
