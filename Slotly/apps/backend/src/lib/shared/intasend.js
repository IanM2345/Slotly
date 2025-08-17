import axios from 'axios';

const MODE = process.env.INTASEND_MODE === 'live' ? 'live' : 'sandbox';
const INTASEND_SECRET = process.env.INTASEND_SECRET;   // Bearer token (server)
const INTASEND_PUB_KEY = process.env.INTASEND_PUB_KEY; // optional (frontend)

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
    Authorization: `Bearer ${INTASEND_SECRET}`, // ← fix: backticks
    'Content-Type': 'application/json',
  },
});

// Optional: add an Idempotency-Key header for POST/PUT/PATCH (retry-safe)
intasend.interceptors.request.use((config) => {
  if (config.method && ['post', 'put', 'patch'].includes(config.method.toLowerCase())) {
    if (!config.headers['Idempotency-Key'] && !config.headers['Idempotency-key']) {
      config.headers['Idempotency-Key'] = cryptoRandom();
    }
  }
  return config;
});

function cryptoRandom() {
  // small, dependency-free UUID-ish
  return 'idemp_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

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

/** Create a card/M-Pesa checkout link */
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
      amount, currency, email, name, phone, reference, metadata,
      redirect_url, cancel_url,
    });
    return res.data; // { invoice_id, checkout_id, checkout_url, ... }
  });
}

/** Verify a specific checkout/invoice */
export async function checkPaymentStatus({ invoice_id, checkout_id }) {
  if (!invoice_id && !checkout_id) {
    throw new Error('Provide invoice_id or checkout_id');
  }
  return withRetries(async () => {
    const res = await intasend.post('payment/status/', { invoice_id, checkout_id });
    return res.data;
  });
}

/** Not supported reliably—always prefer invoice_id/checkout_id */
export async function fetchPaymentByReference(/* ref */) {
  throw new Error('fetchPaymentByReference is not supported; verify by invoice_id/checkout_id instead.');
}

/** Send Money: initiate payout
 * Depending on your account, approval may be manual (dashboard) or via OTP.
 */
export async function createPayout({
  amount,
  currency = 'KES',
  reason = 'Slotly booking payout',
  reference,
  // unified inputs:
  mpesaPhoneNumber,   // MPESA-B2C
  tillNumber,         // MPESA-TILL
  paybillNumber,      // MPESA-PAYBILL
  accountRef,         // paybill account reference (optional/required per bill)
  bankCode,           // BANK (use listBankCodes to map names -> codes)
  bankAccount,        // BANK
  accountName,        // BANK
  metadata = {},
}) {
  let category;
  const payload = { amount, currency, reason, reference, metadata };

  if (mpesaPhoneNumber) {
    category = 'MPESA-B2C';
    payload.phone_number = mpesaPhoneNumber;
  } else if (tillNumber) {
    category = 'MPESA-TILL';
    payload.till_number = tillNumber;
  } else if (paybillNumber) {
    category = 'MPESA-PAYBILL';
    payload.paybill = paybillNumber;
    if (accountRef) payload.account_reference = accountRef;
  } else if (bankCode && bankAccount && accountName) {
    category = 'BANK';
    payload.bank_code = bankCode;
    payload.account_number = bankAccount;
    payload.account_name = accountName;
  } else {
    throw new Error('Invalid payout destination (need mpesaPhoneNumber | tillNumber | paybillNumber | bankCode+bankAccount+accountName)');
  }
  payload.category = category;

  const res = await withRetries(() => intasend.post('send-money/initiate/', payload));
  return res.data; // e.g., { tracking_id, status, ... }
}

/** (Optional) Approve payout (if your workflow uses OTP approvals) */
export async function approvePayout({ tracking_id, otp }) {
  if (!tracking_id) throw new Error('tracking_id is required');
  const res = await withRetries(() => intasend.post('send-money/approve/', { tracking_id, otp }));
  return res.data;
}

/** (Optional) Bank codes lookup for BANK payouts */
export async function listBankCodes() {
  const res = await withRetries(() => intasend.get('send-money/bank-codes/'));
  return res.data; // array of { code, name, ... }
}

/** Refund by invoice id */
export async function refundPayment({ invoice_id, amount, reason, reason_details }) {
  if (!invoice_id) throw new Error('invoice_id is required for refunds');
  return withRetries(async () => {
    const res = await intasend.post('chargebacks/', {
      invoice: invoice_id, amount, reason, reason_details,
    });
    return res.data;
  });
}

/** Webhook verification
 * If your IntaSend account uses a shared challenge header, verify here;
 * ALWAYS re-check transaction status via checkPaymentStatus before trusting.
 */
export const INTASEND_WEBHOOK_CHALLENGE = process.env.INTASEND_WEBHOOK_CHALLENGE || '';

export function verifyIntaSendSignature(req) {
  try {
    // Next.js Request has Headers with .get()
    const headers = req.headers?.get ? req.headers : null;
    const receivedChallenge =
      headers?.get('x-intasend-challenge') ??
      req.nextUrl?.searchParams?.get?.('challenge') ??
      null;

    if (!INTASEND_WEBHOOK_CHALLENGE) return true; // rely on status re-check as fallback
    return receivedChallenge === INTASEND_WEBHOOK_CHALLENGE;
  } catch {
    return false;
  }
}

export function getPublishableKey() {
  return INTASEND_PUB_KEY || '';
}
