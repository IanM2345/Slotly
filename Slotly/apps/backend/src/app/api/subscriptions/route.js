import '@/sentry.server.config';
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const { businessId, plan, startDate, endDate } = await request.json();

    if (!businessId || !plan || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    
    const existing = await prisma.subscription.findUnique({ where: { businessId } });
    if (existing) {
      return NextResponse.json({ error: 'Business already has a subscription' }, { status: 409 });
    }

    const subscription = await prisma.subscription.create({
      data: {
        businessId,
        plan,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: new Date(endDate) > new Date(),
      },
    });

    return NextResponse.json(subscription, { status: 201 });
  } catch (error) {
    Sentry.captureException?.(error);
    console.error('Error creating subscription:', error);
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
  }
}


export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    const where = businessId ? { businessId } : {};

    const subscriptions = await prisma.subscription.findMany({
      where,
      orderBy: { startDate: 'desc' },
      include: {
        business: true,
      },
    });

    return NextResponse.json(subscriptions, { status: 200 });
  } catch (error) {
    Sentry.captureException?.(error);
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
  }
}
