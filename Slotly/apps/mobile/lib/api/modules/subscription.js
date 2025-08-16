/**
 * Subscription payments client for Slotly (mobile).
 *
 * Endpoints expected:
 *   POST /api/subscription-payments
 *   GET  /api/subscription-payments?subscriptionId=...
 * (optional)
 *   POST /api/subscriptions/:id/pay    // proxy to collection route
 *
 * Usage:
 *   const { link, subscriptionPaymentId } = await createSubscriptionPayment({ ... });
 *   // open `link` in WebView/Browser
 *   // on return, poll:
 *   const paid = await waitUntilPaid({ subscriptionId, timeoutMs: 60_000 });
 */

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  ''; // e.g. https://api.slotly.yourdomain.com

const DEFAULT_TIMEOUT_MS = 20_000;

function assertBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error(
      'API_BASE_URL is not set. Define EXPO_PUBLIC_API_BASE_URL or API_BASE_URL for the mobile app.'
    );
  }
}

async function http(path, { method = 'GET', headers = {}, body, timeout = DEFAULT_TIMEOUT_MS } = {}) {
  assertBaseUrl();

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeout);

  const finalHeaders = {
    Accept: 'application/json',
    ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...headers,
  };

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: finalHeaders,
      body: body && !(body instanceof FormData) ? JSON.stringify(body) : body,
      signal: controller.signal,
    });

    const text = await res.text();
    const isJson = res.headers.get('content-type')?.includes('application/json');
    const data = isJson && text ? JSON.parse(text) : text;

    if (!res.ok) {
      const msg = (data && data.error) || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  } finally {
    clearTimeout(t);
  }
}

/** ---------- Core API ---------- */

/**
 * Create/initiate a subscription payment.
 * Backend returns: { link, subscriptionPaymentId }
 */
export async function createSubscriptionPayment({
  subscriptionId,
  returnUrl,     // e.g. 'slotly://payments/success'
  cancelUrl,     // e.g. 'slotly://payments/cancel'
  amount,        // optional; server can derive
  currency,      // optional (defaults server-side)
  customer,      // optional { email, name, phone_number }
  metadata = {}, // optional extras (e.g. { source: 'mobile', phone: '07...' })
}) {
  if (!subscriptionId) throw new Error('subscriptionId is required');
  if (!returnUrl || !cancelUrl) throw new Error('returnUrl and cancelUrl are required');

  return http('/api/subscription-payments', {
    method: 'POST',
    body: {
      subscriptionId,
      amount,
      currency,
      returnUrl,
      cancelUrl,
      customer,
      metadata,
    },
  });
}

/**
 * (Optional) If you exposed resource route /api/subscriptions/:id/pay
 */
export async function paySubscriptionViaResource(
  subscriptionId,
  { returnUrl, cancelUrl, amount, currency, customer, metadata = {} }
) {
  if (!subscriptionId) throw new Error('subscriptionId is required');
  if (!returnUrl || !cancelUrl) throw new Error('returnUrl and cancelUrl are required');

  return http(`/api/subscriptions/${encodeURIComponent(subscriptionId)}/pay`, {
    method: 'POST',
    body: { amount, currency, returnUrl, cancelUrl, customer, metadata },
  });
}

/**
 * List payments for a subscription (latest first on server).
 * Returns an array of SubscriptionPayment objects.
 */
export async function getSubscriptionPayments(subscriptionId) {
  if (!subscriptionId) throw new Error('subscriptionId is required');
  const qs = `?subscriptionId=${encodeURIComponent(subscriptionId)}`;
  return http(`/api/subscription-payments${qs}`, { method: 'GET' });
}

/** ---------- Helpers / UX glue ---------- */

/**
 * Wait until a subscription becomes PAID (polling).
 * Resolves `true` if paid within timeout, `false` otherwise.
 */
export async function waitUntilPaid({
  subscriptionId,
  intervalMs = 3000,
  timeoutMs = 90_000,
  isPaid = (p) => p.status === 'PAID' || p.status === 'SUCCESS',
} = {}) {
  if (!subscriptionId) throw new Error('subscriptionId is required');

  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const list = await getSubscriptionPayments(subscriptionId);
    const latest = Array.isArray(list) ? list[0] : null;

    if (latest && isPaid(latest)) return true;

    if (Date.now() - start > timeoutMs) return false;

    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/**
 * Convenience: open the checkout link and poll until paid.
 * `open` should be a function that opens the URL (WebBrowser.openBrowserAsync / Linking.openURL)
 *
 * Returns { paid: boolean, link: string, subscriptionPaymentId: string }
 */
export async function payAndWait({
  subscriptionId,
  returnUrl,
  cancelUrl,
  amount,
  currency,
  customer,
  metadata,
  open,            // async (url) => void
  poll = { intervalMs: 3000, timeoutMs: 90_000 },
}) {
  const { link, subscriptionPaymentId } = await createSubscriptionPayment({
    subscriptionId,
    returnUrl,
    cancelUrl,
    amount,
    currency,
    customer,
    metadata,
  });

  if (typeof open === 'function' && link) {
    await open(link);
  }

  const paid = await waitUntilPaid({ subscriptionId, ...poll });
  return { paid, link, subscriptionPaymentId };
}
