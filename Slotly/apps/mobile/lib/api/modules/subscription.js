// apps/mobile/lib/api/modules/subscription.js
import api from "../../api/client";

/**
 * Create/initiate a subscription payment.
 * Backend returns: { link, subscriptionPaymentId, reference, invoiceId }
 */
export async function createSubscriptionPayment({
  subscriptionId,
  returnUrl,
  cancelUrl,
  amount,     // optional
  currency,   // optional, defaults to 'KES' server-side
  customer,   // optional { email, name, phone_number }
  metadata,   // optional
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

  // { link, subscriptionPaymentId, reference, invoiceId }
  return data;
}

/**
 * List payments for a subscription (latest first on server).
 * Returns an array of SubscriptionPayment objects.
 */
export async function getSubscriptionPayments(subscriptionId) {
  if (!subscriptionId) throw new Error("subscriptionId is required");
  const { data } = await api.get("/api/payments/subscriptionPayments", {
    params: { subscriptionId },
  });
  return data;
}

/**
 * Wait until a subscription becomes paid (polling).
 * Resolves { paid: boolean, latest?: object }
 */
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
    if (isPaid(latest)) {
      return { paid: true, latest };
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { paid: false };
}

/**
 * Convenience: open the checkout link and poll until paid.
 * open is a function to open the URL (WebBrowser.openBrowserAsync / Linking.openURL).
 */
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

  if (typeof open === "function" && link) {
    await open(link);
  }

  const { paid, latest } = await waitUntilPaid({
    subscriptionId,
    ...poll,
  });

  return { paid, link, subscriptionPaymentId, reference, invoiceId, latest };
}