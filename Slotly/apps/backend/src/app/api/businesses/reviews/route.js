import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import * as Sentry from '@sentry/nextjs';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '3', 10), 1), 25);
    const skip = (page - 1) * limit;

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 });
    }

    const [agg, items] = await Promise.all([
      prisma.review.aggregate({
        where: { businessId },
        _avg: { rating: true },
        _count: { rating: true },
      }),
      prisma.review.findMany({
        where: { businessId },
        select: {
          id: true,
          rating: true,
          comment: true,
          imageUrl: true,
          createdAt: true,
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      averageRating: agg._avg.rating || 0,
      reviewCount: agg._count.rating || 0,
      page,
      limit,
      reviews: items,
    });
  } catch (error) {
    console.error('Error fetching business reviews:', error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}