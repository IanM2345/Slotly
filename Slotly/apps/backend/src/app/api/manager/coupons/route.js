import "@/sentry.server.config";
import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
import { verifyToken } from "@/middleware/auth";
import { createNotification } from "@/shared/notifications/createNotification";
import { couponAccessByPlan } from "@/shared/subscriptionPlanUtils";

const prisma = new PrismaClient();

/** Resolve business from Bearer token */
async function getBusinessFromToken(request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Unauthorized", status: 401 };
  }
  const token = authHeader.split(" ")[1];
  const { valid, decoded } = await verifyToken(token);
  if (!valid) {
    return { error: "Unauthorized", status: 401 };
  }
  if (decoded.role !== "BUSINESS_OWNER") {
    return { error: "Forbidden", status: 403 };
  }

  const business = await prisma.business.findFirst({
    where: { ownerId: decoded.userId },
  });
  if (!business) {
    return { error: "Business not found", status: 404 };
  }

  return { business, ownerId: decoded.userId };
}

/* ------------------------------- POST /create ------------------------------ */

export async function POST(request) {
  try {
    const who = await getBusinessFromToken(request);
    if (who.error) return NextResponse.json({ error: who.error }, { status: who.status });

    const { business, ownerId } = who;

    if (!couponAccessByPlan[business.plan]) {
      Sentry.captureMessage(`Coupon access (POST) blocked for ${business.id} (${business.plan})`);
      await createNotification({
        userId: ownerId,
        type: "SYSTEM",
        title: "Coupon Feature Unavailable",
        message: `Your current plan (${business.plan}) does not support coupons. Upgrade your plan to unlock this feature.`,
      });
      return NextResponse.json(
        {
          error: "Your plan does not support coupon creation or management.",
          suggestion: "Upgrade your plan to enable coupon functionality.",
        },
        { status: 403 }
      );
    }

    const { code, description, discount, isPercentage, expiresAt } = await request.json();

    if (!code || discount == null || !expiresAt) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const exists = await prisma.coupon.findFirst({
      where: { code, businessId: business.id },
      select: { id: true },
    });
    if (exists) {
      return NextResponse.json({ error: "Coupon code already exists" }, { status: 409 });
    }

    const newCoupon = await prisma.coupon.create({
      data: {
        code: String(code).trim(),
        description: description || null,
        discount: Number(discount),
        isPercentage: Boolean(isPercentage),
        expiresAt: new Date(expiresAt),
        businessId: business.id,
      },
    });

    await createNotification({
      userId: ownerId,
      type: "COUPON",
      title: "New Coupon Created",
      message: `Coupon code "${newCoupon.code}" has been created.`,
    });

    return NextResponse.json(newCoupon, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    console.error("POST /manager/coupons error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/* -------------------------------- GET /list -------------------------------- */

export async function GET(request) {
  try {
    const who = await getBusinessFromToken(request);
    if (who.error) return NextResponse.json({ error: who.error }, { status: who.status });

    const { business } = who;

    if (!couponAccessByPlan[business.plan]) {
      Sentry.captureMessage(`Coupon access (GET) blocked for ${business.id} (${business.plan})`);
      return NextResponse.json(
        {
          error: "Your plan does not support viewing coupons.",
          suggestion: "Upgrade to view and manage your coupons.",
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const active = searchParams.get("active");
    const expired = searchParams.get("expired");
    const used = searchParams.get("used");

    const now = new Date();

    const where = { businessId: business.id };

    if (active === "true") {
      where.expiresAt = { gt: now };
    } else if (expired === "true") {
      where.expiresAt = { lt: now };
    }

    if (used === "true") {
      where.userCoupons = { some: { usedAt: { not: null } } };
    } else if (used === "false") {
      where.userCoupons = { none: { usedAt: { not: null } } };
    }

    const coupons = await prisma.coupon.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        userCoupons: {
          include: { user: true },
        },
      },
    });

    // DO NOT create notifications during a GET (would spam on every refresh).
    const response = coupons.map((c) => {
      const usageCount = c.userCoupons.filter((uc) => uc.usedAt !== null).length;
      const redeemedUsers = c.userCoupons.length;
      return { ...c, usageCount, redeemedUsers };
    });

    return NextResponse.json({ coupons: response }, { status: 200 });
  } catch (err) {
    Sentry.captureException(err);
    console.error("GET /manager/coupons error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/* ------------------------------- DELETE /id -------------------------------- */

export async function DELETE(request) {
  try {
    const who = await getBusinessFromToken(request);
    if (who.error) return NextResponse.json({ error: who.error }, { status: who.status });

    const { business } = who;

    if (!couponAccessByPlan[business.plan]) {
      Sentry.captureMessage(`Coupon access (DELETE) blocked for ${business.id} (${business.plan})`);
      return NextResponse.json(
        {
          error: "Your plan does not support managing coupons.",
          suggestion: "Upgrade to view and manage your coupons.",
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Coupon ID required" }, { status: 400 });
    }

    const coupon = await prisma.coupon.findFirst({
      where: { id, businessId: business.id },
      include: { userCoupons: true },
    });
    if (!coupon) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }

    if (coupon.userCoupons.some((uc) => uc.usedAt !== null)) {
      return NextResponse.json({ error: "Cannot delete a used coupon" }, { status: 400 });
    }

    await prisma.coupon.delete({ where: { id } });
    return NextResponse.json({ message: "Coupon deleted successfully" }, { status: 200 });
  } catch (err) {
    Sentry.captureException(err);
    console.error("DELETE /manager/coupons error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
