// apps/backend/src/lib/shared/intasend.js
import axios from 'axios';

const MODE = process.env.INTASEND_MODE === 'live' ? 'live' : 'sandbox';
const INTASEND_SECRET = process.env.INTASEND_SECRET;   // Bearer token (server)
const INTASEND_PUB_KEY = process.env.INTASEND_PUB_KEY; // optional (frontend)

// Use API v1 hosts per docs
const BASE_URL =
  MODE === 'live'
    ? 'https://payment.intasend.com/api/v1/'
    : 'https://sandbox.intasend.com/api/v1/';

if (!INTASEND_SECRET) {
  console.warn('[IntaSend] Missing INTASEND_SECRET in env!');
}

export const intasend = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    Authorization: `Bearer ${INTASEND_SECRET}`,
    'Content-Type': 'application/json',
  },
});

// Small helper to sleep for backoff
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetries(fn, { max = 3 } = {}) {
  let attempt = 0, lastErr;
  while (attempt < max) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const code = err?.response?.status;
      if (code && code < 500) break; // don't retry 4xx
      attempt++;
      if (attempt < max) await wait(500 * 2 ** (attempt - 1));
    }
  }
  throw lastErr;
}

/**
 * Create a checkout/payment link the client can open (card/M-Pesa).
 * Returns { invoice_id, checkout_id?, checkout_url, ... }
 */
export async function createPaymentCheckout({
  amount,
  currency = 'KES',
  email,
  name,
  phone,
  reference,     // your txRef for traceability
  redirect_url,  // success
  cancel_url,    // cancel/fail
  metadata = {},
}) {
  return withRetries(async () => {
    const res = await intasend.post('checkout/', {
      amount,
      currency,
      email,
      name,
      phone,
      redirect_url,
      cancel_url,
      reference,
      metadata,
      // method selection is handled by IntaSend unless your account requires explicit flags
    });
    return res.data;
  });
}

/**
 * Check payment status by invoice_id or checkout_id.
 * Prefer this over trying to filter /transactions by reference.
 */
export async function checkPaymentStatus({ invoice_id, checkout_id }) {
  if (!invoice_id && !checkout_id) {
    throw new Error('Provide invoice_id or checkout_id');
  }
  return withRetries(async () => {
    const res = await intasend.post('payment/status/', {
      invoice_id,
      checkout_id,
    });
    return res.data;
  });
}

/**
 * (Optional) List transactions — filters vary by account.
 * Note: This is not the primary way to check a specific checkout’s status.
 */
export async function listTransactions(params = {}) {
  return withRetries(async () => {
    const res = await intasend.get('transactions/', { params });
    return res.data;
  });
}

/**
 * Payouts via Send Money API (two-step: initiate -> approve).
 * Provide a category and destination details per IntaSend docs.
 */
export async function createPayoutInitiate({
  amount,
  currency = 'KES',
  reason = 'Slotly booking payout',
  reference,
  category, // e.g., 'MPESA-B2C', 'MPESA-TILL', 'MPESA-PAYBILL', 'BANK'
  // destination fields depend on the category:
  phone_number,     // for MPESA-B2C e.g. '2547XXXXXXXX'
  till_number,      // for MPESA-TILL
  paybill,          // for MPESA-PAYBILL
  account_reference,// optional, with paybill
  bank_code,        // for BANK (use List Bank Codes API)
  account_number,
  account_name,
  metadata = {},
}) {
  const payload = {
    amount,
    currency,
    reason,
    reference,
    category,
    phone_number,
    till_number,
    paybill,
    account_reference,
    bank_code,
    account_number,
    account_name,
    metadata,
  };
  return withRetries(async () => {
    const res = await intasend.post('send-money/initiate/', payload);
    return res.data; // contains tracking/approval info
  });
}

export async function approvePayout({ tracking_id, otp }) {
  if (!tracking_id) throw new Error('tracking_id is required');
  return withRetries(async () => {
    const res = await intasend.post('send-money/approve/', {
      tracking_id,
      otp, // if your workflow requires it; some accounts approve via dashboard
    });
    return res.data;
  });
}

/**
 * Refunds (chargebacks) – reference by invoice id.
 */
export async function refundPayment({ invoice_id, amount, reason, reason_details }) {
  if (!invoice_id) throw new Error('invoice_id is required for refunds');
  return withRetries(async () => {
    const res = await intasend.post('chargebacks/', {
      invoice: invoice_id,
      amount,
      reason,
      reason_details,
    });
    return res.data;
  });
}

// Webhook verification: validate the dashboard-provided challenge
// and *always* re-check payment/send-money status before trusting.
export const INTASEND_WEBHOOK_CHALLENGE = process.env.INTASEND_WEBHOOK_CHALLENGE || '';

export function verifyIntaSendWebhook(req) {
  try {
    // Example: they send the challenge you configured; confirm it matches.
    const receivedChallenge = req.headers['x-intasend-challenge'] || req.query.challenge || req.body?.challenge;
    return Boolean(INTASEND_WEBHOOK_CHALLENGE && receivedChallenge === INTASEND_WEBHOOK_CHALLENGE);
  } catch {
    return false;
  }
}

export function getPublishableKey() {
  return INTASEND_PUB_KEY || '';
}
