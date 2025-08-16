// apps/mobile/lib/api/modules/subscription.js

/**
 * Minimal, resilient API client for Slotly subscriptions.
 * - Matches your Next.js backend routes:
 *   /api/subscriptions            (POST, GET)
 *   /api/subscriptions/[id]       (GET, PUT, DELETE)
 *
 * - Payment helpers:
 *   Tries these endpoints (first one that exists wins):
 *     1) /api/subscriptions/:id/pay                  (POST)      <-- nice, resource-scoped
 *     2) /api/payments/checkout (POST, {type:'subscription'})    <-- generic checkout
 *
 *   Expects backend to return { checkoutUrl } or { status: 'paid' | 'pending', ... }.
 *
 * Works in React Native / Expo (fetch-based).
 */

const DEFAULT_TIMEOUT_MS = 20_000;

// You can set this from your mobile runtime env (e.g., via Expo constants)
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  ''; // e.g. "https://your-slotly-backend.example.com"

/** Abortable fetch with sane defaults */
async function http(path, { method = 'GET', headers = {}, body, timeout = DEFAULT_TIMEOUT_MS } = {}) {
  if (!API_BASE_URL) {
    throw new Error('API_BASE_URL is not configured. Set EXPO_PUBLIC_API_BASE_URL or API_BASE_URL.');
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeout);

  const finalHeaders = {
    'Accept': 'application/json',
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

/** Utils */
const toISODate = (d) => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());

/* =========================
 * Subscriptions (Collection)
 * ========================= */

/**
 * Create a subscription (Business action).
 * POST /api/subscriptions
 */
export async function createSubscription({ businessId, plan, startDate, endDate }) {
  if (!businessId || !plan || !startDate || !endDate) {
    throw new Error('Missing required fields: businessId, plan, startDate, endDate');
  }

  return http('/api/subscriptions', {
    method: 'POST',
    body: {
      businessId,
      plan,
      startDate: toISODate(startDate),
      endDate: toISODate(endDate),
    },
  });
}

/**
 * Get subscriptions (optionally filter by businessId)
 * GET /api/subscriptions?businessId=...
 */
export async function getSubscriptions({ businessId } = {}) {
  const qs = businessId ? `?businessId=${encodeURIComponent(businessId)}` : '';
  return http(`/api/subscriptions${qs}`, { method: 'GET' });
}

/* =========================
 * Subscription (Single)
 * ========================= */

/**
 * Get a subscription by id
 * GET /api/subscriptions/:id
 */
export async function getSubscriptionById(id) {
  if (!id) throw new Error('id is required');
  return http(`/api/subscriptions/${encodeURIComponent(id)}`, { method: 'GET' });
}

/**
 * Update a subscription (STAFF only; backend checks header x-user-role)
 * PUT /api/subscriptions/:id
 */
export async function updateSubscription(id, { plan, startDate, endDate, isActive }, { role = 'STAFF' } = {}) {
  if (!id) throw new Error('id is required');
  if (!plan || !startDate || !endDate) {
    throw new Error('Missing required fields: plan, startDate, endDate');
  }

  return http(`/api/subscriptions/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'x-user-role': role },
    body: {
      plan,
      startDate: toISODate(startDate),
      endDate: toISODate(endDate),
      ...(typeof isActive === 'boolean' ? { isActive } : {}),
    },
  });
}

/**
 * Delete a subscription (STAFF only)
 * DELETE /api/subscriptions/:id
 */
export async function deleteSubscription(id, { role = 'STAFF' } = {}) {
  if (!id) throw new Error('id is required');
  return http(`/api/subscriptions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'x-user-role': role },
  });
}

/* =========================
 * Payments
 * =========================
 * Business-facing helpers to pay for a subscription.
 *
 * We try a resource-scoped endpoint first:
 *   POST /api/subscriptions/:id/pay
 *     body: { provider?, amount?, currency?, returnUrl, cancelUrl, metadata? }
 *     -> { checkoutUrl } OR { status: 'paid' | 'pending', ... }
 *
 * Fallback to a generic checkout:
 *   POST /api/payments/checkout
 *     body: { type: 'subscription', subscriptionId, amount?, currency?, returnUrl, cancelUrl, metadata? }
 *     -> { checkoutUrl } OR { status: ... }
 */

/**
 * Initiate payment and get a URL to redirect (or a status if immediate).
 * Returns: { checkoutUrl?, status?, provider?, reference?, ... }
 */
export async function payForSubscription({
  subscriptionId,
  amount,         // optional; backend can compute based on plan
  currency,       // e.g. 'KES', 'USD'
  provider,       // e.g. 'stripe', 'mpesa'
  returnUrl,      // deep link / app scheme or web URL after success
  cancelUrl,      // deep link / app scheme or web URL after cancel
  metadata = {},  // any extras (e.g., source='mobile')
}) {
  if (!subscriptionId) throw new Error('subscriptionId is required');
  if (!returnUrl || !cancelUrl) {
    throw new Error('returnUrl and cancelUrl are required to complete the payment flow');
  }

  const body = {
    ...(provider ? { provider } : {}),
    ...(amount ? { amount } : {}),
    ...(currency ? { currency } : {}),
    returnUrl,
    cancelUrl,
    metadata: { ...metadata, kind: 'subscription', subscriptionId },
  };

  // Try resource-scoped endpoint first
  try {
    return await http(`/api/subscriptions/${encodeURIComponent(subscriptionId)}/pay`, {
      method: 'POST',
      body,
    });
  } catch (e) {
    // If that route doesn't exist, fall back to a generic checkout endpoint
    if (e?.status === 404) {
      return http('/api/payments/checkout', {
        method: 'POST',
        body: {
          type: 'subscription',
          subscriptionId,
          ...body,
        },
      });
    }
    throw e;
  }
}

/**
 * Optionally confirm a payment (depends on your provider flow).
 * Useful when you get redirected back to the app.
 * Example backend routes you might expose:
 *   GET /api/payments/confirm?provider=stripe&sessionId=cs_...
 *   GET /api/payments/confirm?provider=mpesa&checkoutRequestID=...
 */
export async function confirmPayment(query) {
  const params = new URLSearchParams(query || {});
  if (![...params.keys()].length) {
    throw new Error('confirmPayment requires provider query params (e.g., sessionId, checkoutRequestID).');
  }
  return http(`/api/payments/confirm?${params.toString()}`, { method: 'GET' });
}

/* =========================
 * Convenience flows
 * ========================= */

/**
 * Create → Pay in one go (for business UX).
 * Returns: { subscription, payment }
 */
export async function createAndPaySubscription(
  { businessId, plan, startDate, endDate },
  { amount, currency, provider, returnUrl, cancelUrl, metadata } = {}
) {
  const subscription = await createSubscription({ businessId, plan, startDate, endDate });
  const payment = await payForSubscription({
    subscriptionId: subscription.id,
    amount,
    currency,
    provider,
    returnUrl,
    cancelUrl,
    metadata,
  });
  return { subscription, payment };
}
