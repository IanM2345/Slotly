import '@/sentry.server.config';
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@generated/prisma';
import { verifyToken } from '@/middleware/auth';
import { isSameDay } from 'date-fns';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);
    if (!valid || !decoded?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const staffId = decoded.userId;
    const url = new URL(request.url);
    const upcoming = url.searchParams.get('upcoming') === 'true';
    const dateParam = url.searchParams.get('date');
    const status = url.searchParams.get('status');

    const filters = { staffId };

    if (upcoming) {
      filters.startTime = {
        gte: new Date(),
      };
    }

    if (status) {
      filters.status = status;
    }

    let bookings = await prisma.booking.findMany({
      where: filters,
      orderBy: { startTime: 'asc' },
      include: {
        service: true,
        business: true,
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
    });

    if (dateParam) {
      const targetDate = new Date(dateParam);
      bookings = bookings.filter(booking =>
        isSameDay(new Date(booking.startTime), targetDate)
      );
    }

    return NextResponse.json({ bookings }, { status: 200 });
  } catch (error) {
    Sentry.captureException?.(error);
    console.error('Error fetching staff bookings', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
