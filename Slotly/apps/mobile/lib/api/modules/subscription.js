// apps/mobile/lib/api/modules/subscription.js
import api from "../../api/client";

/**
 * Current business subscription for the logged-in BUSINESS_OWNER.
 * Backend returns the raw Subscription row.
 * GET /api/manager/subscription
 */
export async function getCurrentSubscription() {
  const { data } = await api.get("/api/manager/subscription");
  // If your backend 404s with { error: 'Subscription not found' }, surface null for UI
  if (!data || data.error) return null;
  return data; // subscription object
}

/**
 * Create/Change subscription plan (server computes the amount).
 * POST /api/manager/subscription
 * For LEVEL_1: activates immediately and returns { active: true, subscriptionId }.
 * For paid tiers: returns { checkoutUrl, subscriptionId, active: false }.
 */
export async function startOrChangeSubscription({ plan }) {
  const { data } = await api.post("/api/manager/subscription", { plan });
  return data;
}

/* ---------------- existing exports you already had ---------------- */

/**
 * Create/initiate a subscription payment.
 * Backend returns: { link, subscriptionPaymentId, reference, invoiceId }
 */
export async function createSubscriptionPayment({
  subscriptionId,
  returnUrl,
  cancelUrl,
  amount,
  currency,
  customer,
  metadata,
}) {
  if (!subscriptionId) throw new Error("subscriptionId is required");
  if (!returnUrl || !cancelUrl) throw new Error("returnUrl and cancelUrl are required");

  const { data } = await api.post("/api/payments/subscriptionPayments", {
    subscriptionId,
    amount,
    currency,
    returnUrl,
    cancelUrl,
    customer,
    metadata,
  });
  return data;
}

/** List payments for a subscription (latest first) */
export async function getSubscriptionPayments(subscriptionId) {
  if (!subscriptionId) throw new Error("subscriptionId is required");
  const { data } = await api.get("/api/payments/subscriptionPayments", {
    params: { subscriptionId },
  });
  return data;
}

/** Poll until paid */
export async function waitUntilPaid({
  subscriptionId,
  intervalMs = 3000,
  timeoutMs = 90_000,
  isPaid = (p) => p && (p.status === "PAID" || p.status === "SUCCESS"),
} = {}) {
  if (!subscriptionId) throw new Error("subscriptionId is required");
  const start = Date.now();
  while (Date.now() - start <= timeoutMs) {
    const list = await getSubscriptionPayments(subscriptionId);
    const latest = Array.isArray(list) ? list[0] : null;
    if (isPaid(latest)) return { paid: true, latest };
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { paid: false };
}

/** Open checkout + wait */
export async function payAndWait({
  subscriptionId,
  returnUrl,
  cancelUrl,
  amount,
  currency,
  customer,
  metadata,
  open, // async (url) => void
  poll = { intervalMs: 3000, timeoutMs: 90_000 },
}) {
  const { link, subscriptionPaymentId, reference, invoiceId } =
    await createSubscriptionPayment({
      subscriptionId,
      returnUrl,
      cancelUrl,
      amount,
      currency,
      customer,
      metadata,
    });

  if (typeof open === "function" && link) await open(link);

  const { paid, latest } = await waitUntilPaid({ subscriptionId, ...poll });
  return { paid, link, subscriptionPaymentId, reference, invoiceId, latest };
}
