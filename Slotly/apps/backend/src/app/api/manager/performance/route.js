
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';
import { parseISO } from 'date-fns';

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Set Sentry user context
    Sentry.setUser({ id: decoded.userId, role: decoded.role });

    const business = await prisma.business.findFirst({
      where: { ownerId: decoded.userId },
    });
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const businessId = business.id;

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');
    const dateFilter = startDate && endDate
      ? {
          gte: parseISO(startDate),
          lte: parseISO(endDate),
        }
      : undefined;

    const totalRevenue = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: 'SUCCESS',
        createdAt: dateFilter,
        booking: {
          businessId,
          status: 'COMPLETED',
          createdAt: dateFilter,
        },
      },
    });

    const [totalBookings, cancelledBookings, noShows] = await Promise.all([
      prisma.booking.count({
        where: { businessId, createdAt: dateFilter },
      }),
      prisma.booking.count({
        where: { businessId, status: 'CANCELED', createdAt: dateFilter },
      }),
      prisma.booking.count({
        where: { businessId, status: 'NO_SHOW', createdAt: dateFilter },
      }),
    ]);

    const completedBookings = totalBookings - cancelledBookings - noShows;
    const averageTicketSize =
      completedBookings > 0
        ? (totalRevenue._sum.amount || 0) / completedBookings
        : 0;

    const topServices = await prisma.booking.groupBy({
      by: ['serviceId'],
      where: { businessId, createdAt: dateFilter },
      _count: { serviceId: true },
      orderBy: { _count: { serviceId: 'desc' } },
      take: 5,
    });

    const serviceIds = topServices.map(s => s.serviceId);
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, name: true, price: true },
    });

    const topServiceAnalytics = topServices.map(s => {
      const service = services.find(serv => serv.id === s.serviceId);
      return {
        serviceId: s.serviceId,
        name: service?.name || 'Unknown',
        bookingsCount: s._count.serviceId,
      };
    });

    const staffStats = await prisma.booking.groupBy({
      by: ['staffId'],
      where: {
        businessId,
        status: 'COMPLETED',
        staffId: { not: null },
        createdAt: dateFilter,
      },
      _count: { staffId: true },
      orderBy: { _count: { staffId: 'desc' } },
      take: 5,
    });

    const staffIds = staffStats.map(s => s.staffId);
    const staffDetails = await prisma.user.findMany({
      where: { id: { in: staffIds } },
      select: { id: true, name: true, email: true },
    });

    const staffLeaderboard = staffStats.map(s => {
      const staff = staffDetails.find(st => st.id === s.staffId);
      return {
        staffId: s.staffId,
        name: staff?.name || 'Unknown',
        email: staff?.email || 'Unknown',
        bookingsCount: s._count.staffId,
      };
    });

    // Note: Prisma's $queryRaw must use Prisma.sql for template expressions!
    // If you use it, make sure to import { Prisma } from '@prisma/client'
    // But here's a safer fallback (and skip if you aren't using $queryRaw for now):
    let monthlyBreakdown = [];
    try {
      monthlyBreakdown = await prisma.$queryRaw`
        SELECT
          DATE_TRUNC('month', "createdAt") AS month,
          COUNT(*) AS bookings,
          SUM("totalPrice") AS revenue
        FROM "Booking"
        WHERE "businessId" = ${businessId}
          AND "status" = 'COMPLETED'
          ${dateFilter ? Prisma.sql`AND "createdAt" BETWEEN ${parseISO(startDate)} AND ${parseISO(endDate)}` : Prisma.empty}
        GROUP BY month
        ORDER BY month DESC
        LIMIT 6
      `;
    } catch (rawErr) {
      Sentry.captureException(rawErr);
      // fallback: leave monthlyBreakdown as []
    }

    return NextResponse.json({
      totalRevenue: totalRevenue._sum.amount || 0,
      totalBookings,
      cancelledBookings,
      noShows,
      completedBookings,
      averageTicketSize: Math.round(averageTicketSize),
      topServices: topServiceAnalytics,
      staffLeaderboard,
      monthlyBreakdown,
    }, { status: 200 });

  } catch (error) {
    Sentry.captureException(error);
    console.error('Error fetching performance data:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
