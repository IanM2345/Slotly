// apps/backend/src/app/api/promo/link/route.js
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { requireAuth } from '@/lib/auth'; // TODO: replace with your actual auth utility

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code, businessId, plan, trialEndsOn } = await request.json();
    
    if (!code || !businessId) {
      return NextResponse.json({ error: "code and businessId are required" }, { status: 400 });
    }

    // Verify business ownership
    const biz = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, ownerId: true },
    });
    
    if (!biz || biz.ownerId !== user.id) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // IMPORTANT: do not include businessId in the where filter (it may be null)!
    const redemption = await prisma.promoRedemption.findFirst({
      where: { 
        userId: user.id, 
        code: String(code),
        // Don't filter by businessId here as it might be null initially
      },
    });
    
    if (!redemption) {
      return NextResponse.json({ error: "No redemption found for this code" }, { status: 404 });
    }

    // Check if redemption is already linked to a business
    if (redemption.businessId && redemption.businessId !== businessId) {
      return NextResponse.json({ 
        error: "Promo code is already linked to another business" 
      }, { status: 409 });
    }

    // Update the redemption to link it to the business
    const updatedRedemption = await prisma.promoRedemption.update({
      where: { id: redemption.id },
      data: {
        businessId,
        consumedAt: redemption.consumedAt || new Date(), // Set if not already set
        plan: plan ?? redemption.plan ?? "LEVEL_1",
        ...(trialEndsOn ? { trialEnd: new Date(trialEndsOn) } : {}),
      },
      select: { 
        id: true, 
        code: true, 
        businessId: true, 
        plan: true, 
        consumedAt: true, 
        trialEnd: true 
      }
    });

    return NextResponse.json({ ok: true, redemption: updatedRedemption }, { status: 200 });
  } catch (error) {
    Sentry.captureException(error);
    console.error('POST /api/promo/link error:', error);
    return NextResponse.json({ error: error?.message || "Failed to link promo" }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const code = searchParams.get('code');

    let where = { userId: user.id };
    
    if (businessId) {
      // Verify business ownership
      const biz = await prisma.business.findUnique({
        where: { id: businessId },
        select: { ownerId: true },
      });
      
      if (!biz || biz.ownerId !== user.id) {
        return NextResponse.json({ error: "Business not found" }, { status: 404 });
      }
      
      where.businessId = businessId;
    }

    if (code) {
      where.code = code;
    }

    const redemptions = await prisma.promoRedemption.findMany({
      where,
      orderBy: { redeemedAt: 'desc' },
      include: {
        business: {
          select: { id: true, name: true }
        }
      }
    });

    return NextResponse.json(redemptions, { status: 200 });
  } catch (error) {
    Sentry.captureException(error);
    console.error('GET /api/promo/link error:', error);
    return NextResponse.json({ error: 'Failed to fetch promo redemptions' }, { status: 500 });
  }
}