// apps/backend/src/app/api/subscriptions/route.js
import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
import { requireAuth } from "@/lib/token";

const prisma = globalThis._prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis._prisma = prisma;

export const dynamic = "force-dynamic";

// Helper function to normalize plan names for backward compatibility
function normalizePlan(input) {
  const s = String(input || "LEVEL_1").toUpperCase().replace(/\s+/g, "");
  if (s === "LEVEL1") return "LEVEL_1";
  if (s === "LEVEL2") return "LEVEL_2";
  if (s === "LEVEL3") return "LEVEL_3";
  return s;
}

export async function POST(req) {
  try {
    const user = await requireAuth(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { businessId, plan, promo } = body;

    if (!businessId) return NextResponse.json({ error: "businessId is required" }, { status: 400 });

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, ownerId: true },
    });
    if (!business || business.ownerId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const now = new Date();

    // Resolve plan with normalization (defaults to LEVEL_1)
    const normalizedPlan = normalizePlan(plan);

    // If promo present, attach it to business & use its trialEnd if available
    let trialEndDate = null;
    if (promo?.code) {
      const redemption = await prisma.promoRedemption.findFirst({
        where: { userId: user.id, code: String(promo.code), businessId: null },
        orderBy: { redeemedAt: "desc" },
      });

      if (redemption) {
        await prisma.promoRedemption.update({
          where: { id: redemption.id },
          data: {
            businessId: business.id,
            consumedAt: new Date(),
            plan: normalizedPlan,
            ...(promo?.trialEndsOn ? { trialEnd: new Date(promo.trialEndsOn) } : {}),
          },
        });
        trialEndDate = redemption.trialEnd ?? (promo?.trialEndsOn ? new Date(promo.trialEndsOn) : null);
      }
    }

    const endDate =
      trialEndDate ??
      new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // businessId is unique in your schema — use upsert so re-submits are idempotent
    const subscription = await prisma.subscription.upsert({
      where: { businessId: business.id },
      update: {
        plan: normalizedPlan,
        startDate: now,
        endDate,
        isActive: true,
      },
      create: {
        businessId: business.id,
        plan: normalizedPlan,
        startDate: now,
        endDate,
        isActive: true,
      },
      select: { id: true, businessId: true, plan: true, startDate: true, endDate: true, isActive: true },
    });

    return NextResponse.json({ ok: true, subscription }, { status: 201 });
  } catch (err) {
    console.error("POST /api/subscriptions error:", err);
    return NextResponse.json({ error: "Failed to create subscription" }, { status: 500 });
  }
}