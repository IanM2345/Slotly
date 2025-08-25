import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
import { verifyToken } from "@/middleware/auth";
import { createNotification } from "@/shared/notifications/createNotification";
import { couponAccessByPlan } from "@/shared/subscriptionPlanUtils";

const prisma = new PrismaClient();

/** Resolve business from Bearer token */
async function getBusinessFromToken(request) {
  try {
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
  } catch (error) {
    Sentry.captureException(error);
    return { error: "Token validation failed", status: 500 };
  }
}

/* -------------------------------- GET /list -------------------------------- */

export async function GET(request) {
  try {
    const who = await getBusinessFromToken(request);
    if (who.error) return NextResponse.json({ error: who.error }, { status: who.status });

    const { business } = who;

    // Check plan access - fallback to true if couponAccessByPlan is undefined
    const hasAccess = couponAccessByPlan?.[business.plan] ?? true;
    if (!hasAccess) {
      Sentry.captureMessage(`Coupon access blocked for business ${business.id} with plan ${business.plan}`);
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

    // Handle filters
    if (active === "true") {
      where.expiresAt = { gt: now };
    } else if (expired === "true") {
      where.expiresAt = { lte: now };
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

    // Calculate usage metrics
    const response = coupons.map((c) => {
      const usageCount = c.userCoupons.filter((uc) => uc.usedAt !== null).length;
      const redeemedUsers = c.userCoupons.length;
      return { 
        ...c, 
        usageCount, 
        redeemedUsers 
      };
    });

    return NextResponse.json({ coupons: response }, { status: 200 });
  } catch (err) {
    Sentry.captureException(err);
    console.error("GET /manager/coupons error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/* ------------------------------- POST /create ------------------------------ */

export async function POST(request) {
  try {
    const who = await getBusinessFromToken(request);
    if (who.error) return NextResponse.json({ error: who.error }, { status: who.status });

    const { business, ownerId } = who;

    // Check plan access - fallback to true if couponAccessByPlan is undefined
    const hasAccess = couponAccessByPlan?.[business.plan] ?? true;
    if (!hasAccess) {
      // Try to create notification, but don't fail if it doesn't work
      try {
        await createNotification({
          userId: ownerId,
          type: "SYSTEM",
          title: "Coupon Feature Unavailable",
          message: `Your current plan (${business.plan}) does not support coupons. Upgrade your plan to unlock this feature.`,
        });
      } catch (notificationError) {
        console.warn("Failed to create notification:", notificationError.message);
        Sentry.captureException(notificationError, { tags: { context: "coupon_access_notification" } });
      }
      
      return NextResponse.json(
        {
          error: "Your plan does not support coupon creation or management.",
          suggestion: "Upgrade your plan to enable coupon functionality.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { code, description, discount, isPercentage, expiresAt, usageLimit, minimumSpend } = body;

    // Validate required fields
    if (!code || discount == null || !expiresAt) {
      return NextResponse.json({ error: "Missing required fields: code, discount, and expiresAt" }, { status: 400 });
    }

    // Check for duplicate code within the business
    const exists = await prisma.coupon.findFirst({
      where: { 
        code: String(code).trim().toUpperCase(), 
        businessId: business.id 
      },
      select: { id: true },
    });
    if (exists) {
      return NextResponse.json({ error: "Coupon code already exists" }, { status: 409 });
    }

    // Validate expiration date
    const expiryDate = new Date(expiresAt);
    if (expiryDate <= new Date()) {
      return NextResponse.json({ error: "Expiration date must be in the future" }, { status: 400 });
    }

    // Create the coupon
    const newCoupon = await prisma.coupon.create({
      data: {
        code: String(code).trim().toUpperCase(),
        description: description || null,
        discount: Number(discount),
        isPercentage: Boolean(isPercentage),
        expiresAt: expiryDate,
        usageLimit: usageLimit ? Number(usageLimit) : 1,
        minimumSpend: minimumSpend ? Number(minimumSpend) : null,
        businessId: business.id,
      },
    });

    // Create notification for successful creation - but don't fail if notification fails
    try {
      await createNotification({
        userId: ownerId,
        type: "COUPON",
        title: "New Coupon Created",
        message: `Coupon code "${newCoupon.code}" has been created successfully.`,
      });
    } catch (notificationError) {
      console.warn("Failed to create coupon success notification:", notificationError.message);
      Sentry.captureException(notificationError, { tags: { context: "coupon_success_notification" } });
      // Continue without failing the main operation
    }

    // Set Sentry context for debugging
    Sentry.setContext("coupon", { 
      id: newCoupon.id, 
      code: newCoupon.code, 
      businessId: business.id 
    });

    return NextResponse.json(newCoupon, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    console.error("POST /manager/coupons error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/* ------------------------------- DELETE /id -------------------------------- */

export async function DELETE(request) {
  try {
    const who = await getBusinessFromToken(request);
    if (who.error) return NextResponse.json({ error: who.error }, { status: who.status });

    const { business } = who;

    // Check plan access - fallback to true if couponAccessByPlan is undefined
    const hasAccess = couponAccessByPlan?.[business.plan] ?? true;
    if (!hasAccess) {
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
      return NextResponse.json({ error: "Coupon ID is required" }, { status: 400 });
    }

    // Find the coupon and check ownership
    const coupon = await prisma.coupon.findFirst({
      where: { id, businessId: business.id },
      include: { userCoupons: true },
    });
    if (!coupon) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }

    // Prevent deletion of used coupons
    const hasBeenUsed = coupon.userCoupons.some((uc) => uc.usedAt !== null);
    if (hasBeenUsed) {
      return NextResponse.json(
        { error: "Cannot delete a coupon that has already been used" }, 
        { status: 400 }
      );
    }

    // Delete the coupon and all related userCoupon records
    await prisma.$transaction([
      prisma.userCoupon.deleteMany({ where: { couponId: id } }),
      prisma.coupon.delete({ where: { id } })
    ]);

    return NextResponse.json({ message: "Coupon deleted successfully" }, { status: 200 });
  } catch (err) {
    Sentry.captureException(err);
    console.error("DELETE /manager/coupons error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}