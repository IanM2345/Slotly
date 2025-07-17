import '@/sentry.server.config'; 
import { NextResponse } from 'next/server';
import prisma from '@/generated/prisma';
import * as Sentry from '@sentry/nextjs';

const prisma= new PrismaClient();

export async function POST(request) {
  try {
    const { businessId, title, budget, startDate, endDate } = await request.json();

    if (!businessId || !title || !budget || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { businessId },
    });

    if (!subscription || subscription.plan !== 'PREMIUM' || !subscription.isActive) {
      return NextResponse.json({ error: 'Only active PREMIUM businesses can create campaigns' }, { status: 403 });
    }

    const ad = await prisma.adCampaign.create({
      data: {
        businessId,
        title,
        budget: budget ?? 0,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: new Date(endDate) > new Date(),
      },
    });
    return NextResponse.json(ad, { status: 201 });
  } catch (error) {
    Sentry.captureException(error, {
      extra: { route: 'POST /adCampaign', body: await request.json?.() }
    });
    console.error('Error creating ad campaign:', error);
    return NextResponse.json({ error: 'Failed to create ad campaign' }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return NextResponse.json({ error: 'Missing businessId' }, { status: 400 });
    }

    const filters = { businessId };

    const ads = await prisma.adCampaign.findMany({
      where: filters,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(ads, { status: 200 });
  } catch (error) {
    Sentry.captureException(error, {
      extra: { route: 'GET /adCampaign', url: request.url }
    });
    console.error('Error fetching ad campaigns:', error);
    return NextResponse.json({ error: 'Failed to fetch ad campaigns' }, { status: 500 });
  }
}
