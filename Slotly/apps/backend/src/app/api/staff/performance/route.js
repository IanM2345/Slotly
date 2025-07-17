import '@/sentry.server.config';
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@generated/prisma';
import { verifyToken } from '@/middleware/auth'; 
import { startOfMonth } from 'date-fns';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response('Unauthorized', { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);

    if (!valid || decoded.role !== 'STAFF') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const staffId = decoded.userId;

    const totalBookings = await prisma.booking.count({
      where: { staffId },
    });

    const totalRevenue = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: 'SUCCESS',
        booking: { staffId },
      },
    });

    const TotalRevenue = totalRevenue._sum.amount || 0;

    const enrolledBusinessIds = await prisma.staffEnrollment.findMany({
      where: {
        userId: staffId,
        status: 'APPROVED',
      },
      select: { businessId: true },
    });

    const businessIds = enrolledBusinessIds.map(b => b.businessId);

    const avgRatingAgg = await prisma.review.aggregate({
      _avg: { rating: true },
      where: { businessId: { in: businessIds } },
    });

    const averageRating = avgRatingAgg._avg.rating || null;

    const serviceGroup = await prisma.booking.groupBy({
      by: ['serviceId'],
      where: { staffId },
      _count: { serviceId: true },
      orderBy: { _count: { serviceId: 'desc' } },
      take: 1,
    });

    let mostBookedService = null;
    if (serviceGroup.length > 0) {
      mostBookedService = await prisma.service.findUnique({
        where: { id: serviceGroup[0].serviceId },
        select: {
          id: true,
          name: true,
          price: true,
          duration: true,
        },
      });
    }

    const cancelledBookings = await prisma.booking.count({
      where: {
        staffId,
        status: 'CANCELLED',
      },
    });

  
    const bookingsByMonth = await prisma.booking.groupBy({
      by: [prisma.booking.fields.startTime], 
      where: { staffId },
      _count: { _all: true },
      orderBy: { startTime: 'asc' },
    });

    const revenueByMonthRaw = await prisma.payment.findMany({
      where: {
        status: 'SUCCESS',
        booking: { staffId },
      },
      select: {
        createdAt: true,
        amount: true,
      },
    });

    const monthlyStats = {};

    for (const b of bookingsByMonth) {
      const month = startOfMonth(b.startTime).toISOString().slice(0, 7);
      monthlyStats[month] = monthlyStats[month] || { bookings: 0, revenue: 0 };
      monthlyStats[month].bookings += b._count._all;
    }

    for (const p of revenueByMonthRaw) {
      const month = startOfMonth(p.createdAt).toISOString().slice(0, 7);
      monthlyStats[month] = monthlyStats[month] || { bookings: 0, revenue: 0 };
      monthlyStats[month].revenue += p.amount;
    }

    return NextResponse.json({
      totalBookings,
      TotalRevenue,
      averageRating,
      mostBookedService,
      cancelledBookings,
      monthlyStats,
    }, { status: 200 });

  } catch (error) {
    Sentry.captureException?.(error);
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
