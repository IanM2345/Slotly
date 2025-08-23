import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';

const prisma = new PrismaClient();

async function getBusinessFromToken(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return { error: 'Unauthorized', status: 401 };
    }

    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);
    if (!valid || decoded.role !== 'BUSINESS_OWNER') {
      return { error: 'Forbidden', status: 403 };
    }

    const business = await prisma.business.findFirst({
      where: { ownerId: decoded.userId },
    });

    if (!business) {
      return { error: 'Business not found', status: 404 };
    }

   
    Sentry.setUser({ id: decoded.userId, role: decoded.role });

    return { business };
  } catch (err) {
    Sentry.captureException(err);
    return { error: 'Token validation error', status: 500 };
  }
}

export async function GET(request) {
  try {
    const { business, error, status } = await getBusinessFromToken(request);
    if (error) return NextResponse.json({ error }, { status });

    const reviews = await prisma.review.findMany({
      where: { businessId: business.id },
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ reviews }, { status: 200 });
  } catch (err) {
    Sentry.captureException(err);
    console.error('GET /manager/reviews error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { business, error, status } = await getBusinessFromToken(request);
    if (error) return NextResponse.json({ error }, { status });

    const { searchParams } = new URL(request.url);
    const reviewId = searchParams.get('id');

    if (!reviewId) {
      return NextResponse.json({ error: 'Review ID is required' }, { status: 400 });
    }

    const review = await prisma.review.findFirst({
      where: {
        id: reviewId,
        businessId: business.id,
      },
    });

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    const updated = await prisma.review.update({
      where: { id: reviewId },
      data: { flagged: true },
    });

    return NextResponse.json({ message: 'Review flagged for moderation', review: updated }, { status: 200 });
  } catch (err) {
    Sentry.captureException(err);
    console.error('PATCH /manager/reviews error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
