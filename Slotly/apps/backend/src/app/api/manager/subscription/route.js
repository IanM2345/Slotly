import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';
import * as Sentry from '@sentry/nextjs';
import { createSubscriptionPaymentLink } from '@/lib/shared/flutterwave';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);

    if (!valid || decoded.role !== 'BUSINESS_OWNER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { businessId: decoded.userId },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    return NextResponse.json(subscription, { status: 200 });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);

    if (!valid || decoded.role !== 'BUSINESS_OWNER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const business = await prisma.business.findFirst({
      where: { ownerId: decoded.id },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const plan = business.plan || 'LEVEL_1';

   
    const pricing = {
      LEVEL_1: 0,
      LEVEL_2: 999,
      LEVEL_3: 2999,
      LEVEL_4: 6999,
      LEVEL_5: 14999,
      LEVEL_6: 30000,
    };

    const amount = pricing[plan];

    if (!amount) {
      return NextResponse.json({ error: 'Invalid subscription plan' }, { status: 400 });
    }

    const paymentLink = await createSubscriptionPaymentLink(business, amount);

    return NextResponse.json({ paymentLink }, { status: 200 });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}