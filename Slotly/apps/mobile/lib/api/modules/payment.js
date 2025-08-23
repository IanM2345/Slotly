// apps/mobile/lib/api/modules/payments.js
import api from "../client";

function toMessage(e) {
  return (
    e?.response?.data?.error ||
    e?.response?.data?.message ||
    e?.message ||
    "Network error. Check your connection and try again."
  );
}

/**
 * Attach payout method (no real gateway in your stub).
 * Returns: { tokenRef, brand, last4?, display }
 */
export async function attachPayoutMethod(payload, { timeout = 25000 } = {}) {
  // hit the static route we added: /api/payment-methods/attach (or keep /api/payments/attach)
  const url = "/api/payments/attach"; // keeping original endpoint for now
  try {
    const res = await api.post(url, payload, {
      timeout,                            // survive first compile
      validateStatus: (s) => s < 500,     // let 4xx surface in res.data
    });
    if (res?.data?.error) throw new Error(res.data.error);
    return res?.data;
  } catch (e) {
    const err = new Error(toMessage(e));
    err.cause = e;
    throw err;
  }
}

/** optional: pre-warm the dev server so the POST compiles faster */
export async function prewarmPaymentsAttach() {
  try {
    await api.options("/api/payments/attach", { timeout: 10000 });
  } catch { /* ignore */ }
}

/** Start a payment for a booking */
export async function startBookingPayment({ bookingId }) {
  if (!bookingId) throw new Error("bookingId is required");
  const { data } = await api.post("/api/payments", { bookingId });
  return data; // { link, paymentId, txRef, invoiceId, customer }
}

/** Latest payment status for a booking */
export async function getPaymentStatus(bookingId) {
  if (!bookingId) throw new Error("bookingId is required");
  const { data } = await api.get("/api/payments", { params: { bookingId } });
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

/** Poll until payment settles */
export async function pollPaymentUntilSettled(bookingId, { intervalMs = 2500, maxAttempts = 40 } = {}) {
  const IN_PROGRESS = new Set(["PENDING", "INITIATED", "AWAITING_PAYMENT", "NEW"]);
  let attempts = 0;
  while (attempts < maxAttempts) {
    const latest = await getPaymentStatus(bookingId);
    if (latest && !IN_PROGRESS.has(String(latest.status))) return latest;
    await new Promise((r) => setTimeout(r, intervalMs));
    attempts++;
  }
  return null;
}