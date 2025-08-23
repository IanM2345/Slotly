import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyToken } from "../../../middleware/auth";

// Optional: lightweight CORS for mobile
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req) {
  try {
    const { valid, error } = await verifyToken(req);
    if (!valid) return NextResponse.json({ error }, { status: 401, headers: CORS });

    const body = await req.json().catch(() => ({}));
    const { type, msisdn, tillNumber, paybillNumber, accountRef, bankName, accountNumber, accountName } = body || {};

    // Generate a stub token reference (no real gateway hit)
    const tokenRef = `tok_${Math.random().toString(36).slice(2, 10)}`;

    const brand = String(type || "").startsWith("MPESA") ? "M-PESA" : "Bank";
    const last4 =
      (accountNumber && String(accountNumber).slice(-4)) ||
      (msisdn && String(msisdn).slice(-3)) ||
      undefined;

    const display =
      brand === "M-PESA"
        ? (msisdn && `+2547••• ••${String(msisdn).slice(-3)}`) ||
          (tillNumber && `Till ${tillNumber}`) ||
          (paybillNumber && accountRef && `Paybill ${paybillNumber} / ${accountRef}`) ||
          "M-PESA"
        : (bankName && accountNumber && `${bankName} ••••${String(accountNumber).slice(-4)}`) ||
          "Bank";

    return NextResponse.json({ tokenRef, brand, last4, display }, { status: 200, headers: CORS });
  } catch (err) {
    Sentry.captureException?.(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: CORS });
  }
}
