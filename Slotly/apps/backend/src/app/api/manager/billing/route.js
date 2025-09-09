import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';

const prisma = new PrismaClient();

// single, canonical helper
async function authAndLoadBusiness(request) {
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
      select: { id: true, plan: true, ownerId: true },
    });
    if (!business) return { error: 'Business not found', status: 404 };

    Sentry.setUser({ id: decoded.userId, role: decoded.role, businessId: business.id });
    return { decoded, business };
  } catch (e) {
    Sentry.captureException(e);
    return { error: 'Token validation error', status: 500 };
  }
}

function planLabel(slug) {
  if (!slug) return 'Unknown';
  const parts = String(slug).split('_');
  if (parts.length === 2 && parts[0] === 'LEVEL') return `Level ${parts[1]}`;
  return slug;
}

function parseDateRange(url) {
  const { searchParams } = new URL(url);
  const businessId = searchParams.get('businessId') || undefined;

  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');

  const now = new Date();
  const start = startParam ? new Date(startParam) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = endParam ? new Date(endParam) : new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (endParam && endParam.length === 10) end.setDate(end.getDate() + 1);

  return { businessId, start, end };
}

export async function GET(req) {
  try {
    const { businessId, start, end } = parseDateRange(req.url);

    // Fetch plan info + payments in parallel
    const [business, payments] = await Promise.all([
      businessId
        ? prisma.business.findUnique({
            where: { id: businessId },
            select: {
              // adapt these field names to your schema
              planLevel: true,               // e.g. 'FREE' | 'PRO' | 'BUSINESS'             // Date
            },
          })
        : Promise.resolve(null),
      prisma.payment.findMany({
        where: {
          ...(businessId ? { businessId } : {}),
          type: 'BOOKING',
          status: 'SUCCESS',
          createdAt: { gte: start, lt: end },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Keep response shape friendly to the existing UI
   return NextResponse.json({
   // keep legacy keys but fill what we actually have
   planLevel: null,
   subscriptionStatus: null,
   currentPeriodEnd: null,
   trialEndsAt: null,

   // what your UI actually uses
   plan: business?.plan ?? null,
   planLabel: planLabel(business?.plan ?? ''),

   payments,
 });
  } catch (err) {
    console.error('GET /api/manager/billing error', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { business, error, status } = await authAndLoadBusiness(request);
    if (error) return NextResponse.json({ error }, { status });

    const body = await request.json();
    const { targetPlan } = body;
    if (!targetPlan) {
      return NextResponse.json({ error: 'targetPlan is required' }, { status: 400 });
    }

    return NextResponse.json({
      message: 'Plan upgrade checkout not yet implemented',
      targetPlan,
      businessId: business.id,
    });
  } catch (e) {
    Sentry.captureException(e);
    console.error('POST /manager/billing error:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
