// apps/backend/src/app/api/staff/performance/route.js
import * as Sentry from '@sentry/nextjs';
import { PrismaClient } from '@/generated/prisma';
import { NextResponse } from 'next/server';
import { getStaffContext } from '../route'; // NOTE: ../route (sibling index) is typical
import { startOfMonth, endOfMonth, format } from 'date-fns';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const ctx = await getStaffContext(request);
    if (ctx?.error) return ctx.response;

    const url = new URL(request.url);
    const period = url.searchParams.get('period') || 'all'; // 'month' | 'year' | 'all'
    const year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear()), 10);
    const month = parseInt(url.searchParams.get('month') || String(new Date().getMonth() + 1), 10);

    const baseWhere = {
      staffId: ctx.userId,
      businessId: ctx.business.id,
    };

    // Optional date filter
    let dateFilter = {};
    if (period === 'month') {
      const gte = startOfMonth(new Date(year, month - 1));
      const lte = endOfMonth(new Date(year, month - 1));
      dateFilter = { startTime: { gte, lte } };
    } else if (period === 'year') {
      dateFilter = {
        startTime: {
          gte: new Date(year, 0, 1),
          lte: new Date(year, 11, 31, 23, 59, 59),
        },
      };
    }

    // Fetch core sets once, then aggregate in-memory for charts where needed
    const [allBookings, completed, cancelled, noshow] = await Promise.all([
      prisma.booking.findMany({
        where: { ...baseWhere, ...dateFilter },
        select: { id: true, status: true, startTime: true, serviceId: true },
        orderBy: { startTime: 'asc' },
      }),
      prisma.booking.findMany({
        where: { ...baseWhere, ...dateFilter, status: 'COMPLETED' },
        select: { id: true, startTime: true, serviceId: true },
      }),
      prisma.booking.findMany({
        where: { ...baseWhere, ...dateFilter, status: 'CANCELLED' },
        select: { id: true, startTime: true },
      }),
      prisma.booking.findMany({
        where: { ...baseWhere, ...dateFilter, status: 'NO_SHOW' },
        select: { id: true, startTime: true },
      }),
    ]);

    // Sum revenue = sum(Service.price) for COMPLETED bookings (safer than payment join in mixed flows)
    const serviceIds = Array.from(new Set(completed.map(b => b.serviceId).filter(Boolean)));
    const services = serviceIds.length
      ? await prisma.service.findMany({
          where: { id: { in: serviceIds } },
          select: { id: true, name: true, price: true },
        })
      : [];
    const priceByService = Object.fromEntries(services.map(s => [s.id, s.price || 0]));

    const totalBookings = allBookings.length;
    const completedBookings = completed.length;
    const cancelledBookings = cancelled.length;
    const noShowBookings = noshow.length;

    const totalRevenue = completed.reduce((sum, b) => sum + (priceByService[b.serviceId] || 0), 0);
    // If you pay staff a % commission, apply here; for now treat commissionEarned = revenue
    const commissionEarned = totalRevenue;

    // Average rating — NOTE: there is no staffId on Review in your schema.
    // Returning business-wide average for now; see NOTE below for schema tweak.
    const avgRatingAgg = await prisma.review.aggregate({
      _avg: { rating: true },
      where: { businessId: ctx.business.id },
    });
    const averageRating = Number(avgRatingAgg?._avg?.rating || 0);

    // Top services (by completed count)
    const topCount = completed.reduce((acc, b) => {
      if (!b.serviceId) return acc;
      acc[b.serviceId] = (acc[b.serviceId] || 0) + 1;
      return acc;
    }, {});
    const topServices = Object.entries(topCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([serviceId, count]) => {
        const s = services.find(x => x.id === serviceId);
        return { serviceId, name: s?.name ?? 'Service', count };
      });

    // Monthly stats + series for charts
    const bucketKey = (d) => format(d, 'yyyy-MM');
    const monthly = {};

    // seed buckets for year/month view so chart shows zeroes
    if (period === 'year') {
      for (let m = 1; m <= 12; m++) {
        monthly[format(new Date(year, m - 1, 1), 'yyyy-MM')] = { bookings: 0, revenue: 0, cancellations: 0 };
      }
    } else if (period === 'month') {
      // still bucket by month key (single bucket)
      const key = format(new Date(year, month - 1, 1), 'yyyy-MM');
      monthly[key] = { bookings: 0, revenue: 0, cancellations: 0 };
    }

    for (const b of allBookings) {
      const key = bucketKey(new Date(b.startTime));
      monthly[key] ??= { bookings: 0, revenue: 0, cancellations: 0 };
      monthly[key].bookings += 1;
    }
    for (const b of completed) {
      const key = bucketKey(new Date(b.startTime));
      monthly[key] ??= { bookings: 0, revenue: 0, cancellations: 0 };
      monthly[key].revenue += priceByService[b.serviceId] || 0;
    }
    for (const b of cancelled) {
      const key = bucketKey(new Date(b.startTime));
      monthly[key] ??= { bookings: 0, revenue: 0, cancellations: 0 };
      monthly[key].cancellations += 1;
    }

    // Build simple series arrays for the app
    const orderedKeys = Object.keys(monthly).sort();
    const series = {
      bookings: orderedKeys.map(k => ({ x: k, y: monthly[k].bookings })),
      earnings: orderedKeys.map(k => ({ x: k, y: monthly[k].revenue })),
      cancellations: orderedKeys.map(k => ({ x: k, y: monthly[k].cancellations })),
    };

    // Ratios / scores
    const completionRate = totalBookings > 0 ? Math.round((completedBookings / totalBookings) * 100) : 0;
    const cancellationRate = totalBookings > 0 ? Math.round((cancelledBookings / totalBookings) * 100) : 0;
    const noShowRate = totalBookings > 0 ? Math.round((noShowBookings / totalBookings) * 100) : 0;

    const performanceScore = Math.min(
      100,
      Math.round(completionRate * 0.4 + (100 - cancellationRate) * 0.3 + averageRating * 20 * 0.3)
    );

    return NextResponse.json({
      metrics: {
        totalBookings,
        completedBookings,
        cancelledBookings,
        noShowBookings,
        totalRevenue,
        commissionEarned,
        averageBookingValue: completedBookings > 0 ? Math.round(totalRevenue / completedBookings) : 0,
        completionRate,
        cancellationRate,
        noShowRate,
        averageRating: Math.round(averageRating * 10) / 10,
        performanceScore,
        monthlyStats: monthly,
        series,            // ← charts use this
        topServices,
      },
      period: {
        type: period,
        year,
        month: period === 'month' ? month : null,
        label:
          period === 'month'
            ? format(new Date(year, month - 1), 'MMMM yyyy')
            : period === 'year'
            ? String(year)
            : 'All time',
      },
      business: ctx.business,
    });
  } catch (err) {
    Sentry.captureException?.(err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}