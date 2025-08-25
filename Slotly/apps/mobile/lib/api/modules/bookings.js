// apps/mobile/lib/api/modules/bookings.js
// Updated to always use manager endpoint for business dashboard usage

import api from "../client";

/**
 * List bookings - always hits manager endpoint for proper tenant scoping
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
 * Update booking status or details
 */
export async function updateBooking(id, updates) {
  const { data } = await api.patch(`/api/bookings/${id}`, updates);
  return data;
}

/**
 * Cancel a booking (regular user cancellation)
 */
export async function cancelBooking(id, reason) {
  const { data } = await api.patch(`/api/bookings/${id}`, { 
    status: 'CANCELLED',
    cancelReason: reason 
  });
  return data;
}

/**
 * Reschedule a booking (regular user reschedule)
 */
export async function rescheduleBooking(id, newStartTime) {
  const { data } = await api.patch(`/api/bookings/${id}`, { 
    startTime: newStartTime 
  });
  return data;
}