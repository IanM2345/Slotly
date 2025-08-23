// apps/backend/src/app/api/payments/attach/route.js
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyToken } from "@/middleware/auth";

export const runtime = "nodejs"; // ensure Node runtime for edge-incompatible libs

// Lightweight CORS (adjust origin as needed)
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Utility for masking strings (e.g., emails/phones)
function maskTail(str, visible = 4) {
  if (!str) return str;
  const s = String(str);
  return s.length <= visible ? s : "•".repeat(s.length - visible) + s.slice(-visible);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * POST /api/payments/attach
 * Body: { type, msisdn?, tillNumber?, paybillNumber?, accountRef?, bankName?, accountNumber?, accountName? }
 * Response: { tokenRef, brand, last4?, display }
 *
 * This is a stub "attach payment method" endpoint for no-payments mode.
 * It authenticates the request, generates a token-like reference, and returns
 * a display string + a couple of non-sensitive fields for the mobile UI.
 */
export async function POST(req) {
  try {
    // Auth (supports Request object via verifyToken shim)
    const { valid, error } = await verifyToken(req);
    if (!valid) {
      return NextResponse.json({ error: error || "Unauthorized" }, { status: 401, headers: CORS });
    }

    const body = await req.json().catch(() => ({}));
    const {
      type,
      msisdn,
      tillNumber,
      paybillNumber,
      accountRef,
      bankName,
      accountNumber,
      accountName,
    } = body || {};

    // Generate a stub token (no real gateway call)
    const tokenRef = `tok_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    const isMpesa = String(type || "").toUpperCase().startsWith("MPESA");
    const brand = isMpesa ? "M-PESA" : "Bank";

    const last4 =
      (accountNumber && String(accountNumber).slice(-4)) ||
      (msisdn && String(msisdn).slice(-3)) ||
      undefined;

    // Human-friendly display for the UI
    let display = brand;
    if (isMpesa) {
      if (msisdn) display = `+2547••• ••${String(msisdn).slice(-3)}`;
      else if (tillNumber) display = `Till ${tillNumber}`;
      else if (paybillNumber && accountRef) display = `Paybill ${paybillNumber} / ${accountRef}`;
    } else if (bankName && accountNumber) {
      display = `${bankName} ••••${String(accountNumber).slice(-4)}${accountName ? ` (${accountName})` : ""}`;
    }

    const res = NextResponse.json(
      { tokenRef, brand, last4, display },
      { status: 200, headers: CORS }
    );
    res.headers.set("x-route", "payments/attach"); // helpful for debugging
    return res;
  } catch (err) {
    Sentry.captureException?.(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: CORS });
  }
}
