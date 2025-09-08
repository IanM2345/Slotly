// apps/mobile/lib/api/modules/bookings.js
import api from "../client";

// Tiny cache for "my bookings" (instant paint)
const _cache = { me: { v: null, t: 0 } };
const TTL = 60 * 1000; // 60s

/**
 * @typedef {Object} CachedBookingsData
 * @property {any[]} upcomingBookings
 * @property {any[]} pastBookings
 */

/**
 * @returns {CachedBookingsData | null}
 */
export function peekMyBookings() {
  const c = _cache.me;
  return c && Date.now() - c.t < TTL ? c.v : null;
}

/**
 * List current user's bookings.
 * Expected server response: { upcomingBookings: [], pastBookings: [] }
 */
export async function listUserBookings(params = {}) {
  const { data } = await api.get("/api/users/bookings", { params });
  const shaped = {
    upcomingBookings: Array.isArray(data?.upcomingBookings) ? data.upcomingBookings : [],
    pastBookings: Array.isArray(data?.pastBookings) ? data.pastBookings : [],
  };
  _cache.me = { v: shaped, t: Date.now() };
  return shaped;
}

/**
 * List bookings - manager endpoint for business dashboard usage
 * Business owners automatically get their own business bookings
 * Admins must provide businessId parameter
 */
export async function listBookings(params = {}) {
  const { data } = await api.get("/api/manager/bookings", { params });
  return Array.isArray(data) ? data : (data.bookings ?? []);
}

/**
 * Get booking details by ID
 */
export async function getBooking(id) {
  const { data } = await api.get(`/api/bookings/${id}`);
  return data;
}

/**
 * Create a new booking
 */
export async function createBooking(bookingData) {
  const { data } = await api.post('/api/bookings', bookingData);
  return data;
}

/**
 * Update booking status or details (manager)
 */
export async function updateBooking(id, updates) {
  const { data } = await api.patch(`/api/bookings/${id}`, updates);
  return data;
}

/**
 * Cancel (2-hour policy enforced server-side). If late, returns { checkoutUrl }
 */
// Updated cancel and reschedule functions to use the new RESTful endpoints

export async function cancelBooking(bookingId, { reason } = {}) {
  try {
    const { data } = await api.delete(`/api/users/bookings/${bookingId}`, {
      data: { reason: reason || 'User cancelled' }, // axios sends body for DELETE via 'data'
    });
    _cache.me = { v: null, t: 0 };
    return data;
  } catch (e) {
    // fallback to old POST /cancel if you keep it
    try {
      const { data } = await api.post(`/api/users/bookings/${bookingId}/cancel`, { reason });
      _cache.me = { v: null, t: 0 };
      return data;
    } catch (fallbackError) {
      console.error('Both cancel endpoints failed:', { 
        primary: e.response?.data || e.message,
        fallback: fallbackError.response?.data || fallbackError.message 
      });
      throw e; // throw the original error
    }
  }
}

export async function rescheduleBooking(bookingId, { startTime, endTime, durationMinutes } = {}) {
  try {
    const { data } = await api.patch(`/api/users/bookings/${bookingId}`, { 
      startTime, 
      endTime, 
      durationMinutes 
    });
    _cache.me = { v: null, t: 0 };
    return data;
  } catch (e) {
    // fallback to old /reschedule if you keep it
    try {
      const { data } = await api.patch(`/api/users/bookings/${bookingId}/reschedule`, { 
        startTime, 
        endTime, 
        durationMinutes 
      });
      _cache.me = { v: null, t: 0 };
      return data;
    } catch (fallbackError) {
      console.error('Both reschedule endpoints failed:', { 
        primary: e.response?.data || e.message,
        fallback: fallbackError.response?.data || fallbackError.message 
      });
      throw e; // throw the original error
    }
  }
}