// apps/backend/src/app/api/manager/billing/route.js

import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';
// (Optional) if you have plan feature helpers, you can import them:
// import { getPlanFeatures } from '@/shared/subscriptionPlanUtils';

const prisma = new PrismaClient();

async function getBusinessFromToken(request) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return { error: 'Unauthorized', status: 401 };
    }
    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);
    if (!valid || decoded.role !== 'BUSINESS_OWNER') {
      return { error: 'Unauthorized', status: 403 };
    }
    const business = await prisma.business.findFirst({
      where: { ownerId: decoded.userId },
    });
    if (!business) return { error: 'Business not found', status: 404 };
    Sentry.setUser({ id: decoded.userId, role: decoded.role, businessId: business.id });
    return { business };
  } catch (e) {
    Sentry.captureException(e);
    return { error: 'Token validation error', status: 500 };
  }
}

function planLabel(slug) {
  // LEVEL_1 -> "Level 1"
  if (!slug) return 'Unknown';
  const parts = String(slug).split('_');
  if (parts.length === 2 && parts[0] === 'LEVEL') return `Level ${parts[1]}`;
  return slug;
}

export async function GET(request) {
  try {
    const { business, error, status } = await getBusinessFromToken(request);
    if (error) return NextResponse.json({ error }, { status });

    const subscription = await prisma.subscription.findUnique({
      where: { businessId: business.id },
    });

    const payments = await prisma.subscriptionPayment.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: {
        id: true,
        amount: true,
        currency: true,
        method: true,
        status: true,
        txRef: true,
        provider: true,
        providerPaymentId: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        businessId: business.id,
        plan: business.plan,
        planLabel: planLabel(business.plan),
        subscription: subscription || null,
        payments,
        // features: getPlanFeatures?.(business.plan), // uncomment if you want to show toggleable features
      },
      { status: 200 }
    );
  } catch (e) {
    Sentry.captureException(e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}