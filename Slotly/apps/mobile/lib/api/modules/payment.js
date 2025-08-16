import api from "../../api/client";

/**
 * Start a payment for a booking.
 * Server creates a Payment row and returns a checkout link + paymentId.
 */
export async function startBookingPayment({ bookingId }) {
  const { data } = await api.post("/payments", { bookingId });
  // Expect: { link, paymentId }
  return data;
}

/**
 * Get the latest payment status for a booking.
 * Returns the most recent Payment or null.
 */
export async function getPaymentStatus(bookingId) {
  const { data } = await api.get("/payments", { params: { bookingId }});
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

/**
 * Convenience: poll until payment is no longer PENDING/INITIATED.
 * Will stop after maxAttempts to avoid infinite loops.
 */
export async function pollPaymentUntilSettled(bookingId, {
  intervalMs = 2500,
  maxAttempts = 40
} = {}) {
  let attempts = 0;
  // statuses you consider “not done” — adjust to your webhook mapping
  const inProgress = new Set(["PENDING", "INITIATED", "AWAITING_PAYMENT", "NEW"]);

  while (attempts < maxAttempts) {
    const latest = await getPaymentStatus(bookingId);
    if (latest && !inProgress.has(latest.status)) {
      return latest; // e.g. PAID / FAILED / CANCELLED
    }
    await new Promise(r => setTimeout(r, intervalMs));
    attempts++;
  }
  return null;
}
