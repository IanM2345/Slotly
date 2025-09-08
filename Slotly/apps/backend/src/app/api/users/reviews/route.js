// apps/backend/src/app/api/users/reviews/route.js
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';
import * as Sentry from '@sentry/nextjs';

const prisma = new PrismaClient();

function getUserIdFromToken(decoded) {
  // prefer explicit userId if your auth ever sets it, else fall back to sub
  return decoded?.userId || decoded?.sub || decoded?.id || null;
}

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);
    const userId = valid ? getUserIdFromToken(decoded) : null;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const reviews = await prisma.review.findMany({
      where: { userId },
      include: { business: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(reviews, { status: 200 });
  } catch (error) {
    console.error('Error fetching reviews:', error);
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
    const userId = valid ? getUserIdFromToken(decoded) : null;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { bookingId, businessId: rawBizId, rating, comment, imageUrl } = body;

    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be 1..5' }, { status: 400 });
    }

    // 1) Derive/validate business via completed booking
    let businessId = rawBizId;
    if (bookingId) {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { id: true, userId: true, businessId: true, status: true },
      });
      if (!booking || booking.userId !== userId || booking.status !== 'COMPLETED') {
        return NextResponse.json({ error: 'Only completed bookings can be reviewed' }, { status: 400 });
      }
      businessId = booking.businessId;
    }

    if (!businessId) {
      return NextResponse.json({ error: 'businessId or bookingId required' }, { status: 400 });
    }

    // Optional: harden check (user had at least one COMPLETED booking with this business)
    const hasCompleted = await prisma.booking.findFirst({
      where: { userId, businessId, status: 'COMPLETED' },
      select: { id: true },
    });
    if (!hasCompleted) {
      return NextResponse.json({ error: 'Only completed bookings can be reviewed' }, { status: 400 });
    }

    // 2) Upsert on (userId, businessId)
    const review = await prisma.review.upsert({
      where: { userId_businessId: { userId, businessId } },
      update: { rating, comment, imageUrl },
      create: { userId, businessId, rating, comment, imageUrl },
    });

    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    console.error('Error creating/updating review:', error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);
    const userId = valid ? getUserIdFromToken(decoded) : null;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    if (!businessId) {
      return NextResponse.json({ error: 'Business ID is required' }, { status: 400 });
    }

    const deleted = await prisma.review.deleteMany({
      where: { userId, businessId },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Review deleted' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting review:', error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
