// apps/mobile/lib/api/modules/subscription.js
import { jsonFetch } from "./_fetch";

/**
 * Create subscription (Step 4 of onboarding)
 * payload: { businessId, plan, promo?: { code, trialEndsOn? } }
 */
export function createSubscription(payload, token) {
  return jsonFetch("/api/subscriptions", {
    method: "POST",
    body: payload,
    token,
  });
}

/**
 * Get subscriptions for current user's businesses
 * @param {string} businessId - optional filter
 * @param {string} token - optional if your jsonFetch auto-attaches
 */
export function getSubscriptions(businessId, token) {
  const params = businessId ? `?businessId=${encodeURIComponent(businessId)}` : "";
  return jsonFetch(`/api/subscriptions${params}`, { token });
}

/**
 * Current business subscription for the logged-in BUSINESS_OWNER.
 * Backend returns the raw Subscription row.
 * GET /api/manager/subscription
 */
export async function getCurrentSubscription(token) {
  try {
    const data = await jsonFetch("/api/manager/subscription", { token });
    if (!data || data.error) return null;
    return data; // subscription object
  } catch (error) {
    if (
      typeof error?.message === "string" &&
      (error.message.includes("not found") || error.message.includes("404"))
    ) {
      return null;
    }
    throw error;
  }
}

/**
 * Create/Change subscription plan (server computes the amount).
 * POST /api/manager/subscription
 * For LEVEL_1: activates immediately and returns { active: true, subscriptionId }.
 * For paid tiers: returns { checkoutUrl, subscriptionId, active: false }.
 */
export async function startOrChangeSubscription({ plan }, token) {
  return jsonFetch("/api/manager/subscription", {
    method: "POST",
    body: { plan },
    token,
  });
}

/**
 * Redeem promo code for a trial (one-time per user)
 * POST /api/payments/subscriptionPayments
 */
export async function redeemPromoCode({ plan, code }, token) {
  return jsonFetch("/api/payments/subscriptionPayments", {
    method: "POST",
    body: {
      plan: String(plan || "LEVEL1").toUpperCase(),
      promoCode: String(code || "").trim(),
    },
    token,
  });
}

/**
 * Create/initiate a subscription payment.
 * Backend returns: { link, subscriptionPaymentId, reference, invoiceId }
 */
export async function createSubscriptionPayment(
  { subscriptionId, returnUrl, cancelUrl, amount, currency, customer, metadata },
  token
) {
  if (!subscriptionId) throw new Error("subscriptionId is required");
  if (!returnUrl || !cancelUrl) throw new Error("returnUrl and cancelUrl are required");

  return jsonFetch("/api/payments/subscriptionPayments", {
    method: "POST",
    body: { subscriptionId, amount, currency, returnUrl, cancelUrl, customer, metadata },
    token,
  });
}

/**
 * List payments for a subscription (latest first)
 */
export async function getSubscriptionPayments(subscriptionId, token) {
  if (!subscriptionId) throw new Error("subscriptionId is required");
  return jsonFetch("/api/payments/subscriptionPayments", {
    params: { subscriptionId },
    token,
  });
}

/**
 * Poll until payment is completed
 */
export async function waitUntilPaid(
  {
    subscriptionId,
    intervalMs = 3000,
    timeoutMs = 90_000,
    isPaid = (p) => p && (p.status === "PAID" || p.status === "SUCCESS"),
  } = {},
  token
) {
  if (!subscriptionId) throw new Error("subscriptionId is required");

  const start = Date.now();
  // simple polling loop
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const list = await getSubscriptionPayments(subscriptionId, token);
    const latest = Array.isArray(list) ? list[0] : null;
    if (isPaid(latest)) return { paid: true, latest };

    if (Date.now() - start > timeoutMs) break;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { paid: false };
}

/**
 * Open checkout and wait for payment completion
 */
export async function payAndWait(
  {
    subscriptionId,
    returnUrl,
    cancelUrl,
    amount,
    currency,
    customer,
    metadata,
    open, // async (url) => void
    poll = { intervalMs: 3000, timeoutMs: 90_000 },
  },
  token
) {
  const { link, subscriptionPaymentId, reference, invoiceId } =
    await createSubscriptionPayment(
      { subscriptionId, returnUrl, cancelUrl, amount, currency, customer, metadata },
      token
    );

  if (typeof open === "function" && link) await open(link);

  const { paid, latest } = await waitUntilPaid({ subscriptionId, ...poll }, token);
  return { paid, link, subscriptionPaymentId, reference, invoiceId, latest };
}
