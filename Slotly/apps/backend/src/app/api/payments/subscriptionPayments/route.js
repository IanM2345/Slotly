// apps/backend/src/app/api/payments/subscriptionPayments/route.js
import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
import { authenticateRequest } from "@/middleware/auth";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();
const PROMO = "15208";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "subscriptionPayments" }, { headers: CORS });
}

export async function POST(req) {
  try {
    // auth
    const auth = await authenticateRequest(req);
    if (!auth.valid) {
      return NextResponse.json({ error: auth.error }, { status: 401, headers: CORS });
    }

    const userId = auth.decoded.sub || auth.decoded.id;
    const body = await req.json().catch(() => ({}));

    const promoCode = String(body?.promoCode || body?.code || "").trim();
    const plan = String(body?.plan || "LEVEL1").toUpperCase();

    if (!promoCode) {
      return NextResponse.json({ ok: false, error: "Missing promoCode" }, { status: 400, headers: CORS });
    }
    if (promoCode !== PROMO) {
      return NextResponse.json({ ok: false, error: "Invalid promo code" }, { status: 400, headers: CORS });
    }

    // If a user already redeemed (but not yet consumed/attached to a business),
    // return the same trial window.
    const existing = await prisma.promoRedemption.findFirst({
      where: {
        userId,
        code: PROMO,
        businessId: null,           // <-- use this as the "not yet consumed" marker
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          ok: true,
          trial: {
            startDate: existing.redeemedAt.toISOString(), // use redeemedAt as start
            endDate: existing.trialEnd.toISOString(),
            plan: existing.plan || plan,
          },
        },
        { headers: CORS }
      );
    }

    // Create a new user-level redemption (no business attached yet)
    const now = new Date();
    const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const redemption = await prisma.promoRedemption.create({
      data: {
        userId,
        code: PROMO,
        plan,
        redeemedAt: now,
        trialEnd: end,
        businessId: null,           // <-- not consumed yet
      },
    });

    return NextResponse.json(
      {
        ok: true,
        trial: {
          startDate: redemption.redeemedAt.toISOString(),
          endDate: redemption.trialEnd.toISOString(),
          plan: redemption.plan,
        },
      },
      { headers: CORS }
    );
  } catch (error) {
    console.error("Promo redemption error:", error);
    return NextResponse.json({ ok: false, error: "Failed to redeem promo code" }, { status: 500, headers: CORS });
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}