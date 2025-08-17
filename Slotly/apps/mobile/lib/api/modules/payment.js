// apps/mobile/lib/api/modules/payment.js
import api from "../../api/client";

/**
 * Start a payment for a booking.
 * Server creates a Payment row and returns a checkout link + paymentId.
 * Response: { link, paymentId, txRef, invoiceId, customer }
 */
export async function startBookingPayment({ bookingId }) {
  if (!bookingId) throw new Error("bookingId is required");
  const { data } = await api.post("/api/payments", { bookingId });
  return data; // { link, paymentId, txRef, invoiceId, customer }
}

/**
 * Get the latest payment status for a booking.
 * Returns the most recent Payment or null.
 */
export async function getPaymentStatus(bookingId) {
  if (!bookingId) throw new Error("bookingId is required");
  const { data } = await api.get("/api/payments", { params: { bookingId } });
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

/**
 * Poll until payment is settled.
 * Settled when status is not in the in-progress set.
 */
export async function pollPaymentUntilSettled(
  bookingId,
  { intervalMs = 2500, maxAttempts = 40 } = {}
) {
  const IN_PROGRESS = new Set(["PENDING", "INITIATED", "AWAITING_PAYMENT", "NEW"]);
  let attempts = 0;

  while (attempts < maxAttempts) {
    const latest = await getPaymentStatus(bookingId);
    if (latest && !IN_PROGRESS.has(String(latest.status))) {
      // e.g. SUCCESS / FAILED / REFUNDED
      return latest;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
    attempts++;
  }
  return null; // timed out
}