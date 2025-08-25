// File: apps/backend/src/app/api/staff/performance/route.js
// Staff performance metrics and analytics endpoint

import * as Sentry from '@sentry/nextjs';
import { PrismaClient } from '@/generated/prisma';
import { NextResponse } from 'next/server';
import { getStaffContext } from '../route';
import { startOfMonth, endOfMonth, format } from 'date-fns';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const ctx = await getStaffContext(request);
    if (ctx?.error) return ctx.response;

    const url = new URL(request.url);
    const period = url.searchParams.get('period') || 'all'; // 'month', 'year', 'all'
    const year = parseInt(url.searchParams.get('year') || new Date().getFullYear());
    const month = parseInt(url.searchParams.get('month') || new Date().getMonth() + 1);

    // Base filters for all queries
    const baseWhere = {
      staffId: ctx.userId,
      businessId: ctx.business.id,
    };

    // Add date filters based on period
    let dateFilter = {};
    if (period === 'month') {
      const startDate = startOfMonth(new Date(year, month - 1));
      const endDate = endOfMonth(new Date(year, month - 1));
      dateFilter = {
        startTime: { gte: startDate, lte: endDate }
      };
    } else if (period === 'year') {
      dateFilter = {
        startTime: { 
          gte: new Date(year, 0, 1), 
          lte: new Date(year, 11, 31, 23, 59, 59) 
        }
      };
    }

    // Core performance metrics
    const [
      totalBookings,
      completedBookings,
      cancelledBookings,
      noShowBookings,
      avgRating,
      revenueData,
      topServices
    ] = await Promise.all([
      // Total bookings count
      prisma.booking.count({
        where: { ...baseWhere, ...dateFilter }
      }),

      // Completed bookings count
      prisma.booking.count({
        where: { ...baseWhere, status: 'COMPLETED', ...dateFilter }
      }),

      // Cancelled bookings count
      prisma.booking.count({
        where: { ...baseWhere, status: 'CANCELLED', ...dateFilter }
      }),

      // No-show bookings count
      prisma.booking.count({
        where: { ...baseWhere, status: 'NO_SHOW', ...dateFilter }
      }),

      // Average rating
      prisma.review.aggregate({
        _avg: { rating: true },
        where: { businessId: ctx.business.id, userId: ctx.userId }
      }),

      // Revenue data
      prisma.payment.aggregate({
        _sum: { amount: true },
        _count: { amount: true },
        where: {
          status: 'SUCCESS',
          booking: { ...baseWhere, status: 'COMPLETED', ...dateFilter }
        }
      }),

      // Top services by booking count
      prisma.booking.groupBy({
        by: ['serviceId'],
        where: { ...baseWhere, status: 'COMPLETED', ...dateFilter },
        _count: { serviceId: true },
        orderBy: { _count: { serviceId: 'desc' } },
        take: 5
      })
    ]);

    // Get service details for top services
    const topServiceDetails = await Promise.all(
      topServices.map(async (service) => {
        const serviceInfo = await prisma.service.findUnique({
          where: { id: service.serviceId },
          select: { id: true, name: true, price: true, duration: true }
        });
        return {
          ...serviceInfo,
          bookingCount: service._count.serviceId
        };
      })
    );

    // Monthly breakdown for charts (last 12 months)
    const monthlyStats = {};
    if (period === 'all' || period === 'year') {
      const monthlyBookings = await prisma.booking.groupBy({
        by: ['startTime'],
        where: { ...baseWhere, status: 'COMPLETED' },
        _count: { _all: true },
        orderBy: { startTime: 'asc' }
      });

      // Process monthly data
      monthlyBookings.forEach(booking => {
        const monthKey = format(new Date(booking.startTime), 'yyyy-MM');
        monthlyStats[monthKey] = (monthlyStats[monthKey] || 0) + booking._count._all;
      });
    }

    // Calculate derived metrics
    const totalRevenue = revenueData._sum.amount || 0;
    const commissionRate = 0.1; // 10% commission
    const commissionEarned = Math.round(totalRevenue * commissionRate);
    const completionRate = totalBookings > 0 ? 
      Math.round((completedBookings / totalBookings) * 100) : 0;
    const cancellationRate = totalBookings > 0 ? 
      Math.round((cancelledBookings / totalBookings) * 100) : 0;
    const averageRating = avgRating._avg.rating || 0;

    // Performance score calculation (0-100)
    const performanceScore = Math.min(100, Math.round(
      (completionRate * 0.4) + 
      ((100 - cancellationRate) * 0.3) + 
      (averageRating * 20 * 0.3)
    ));

    return NextResponse.json({
      metrics: {
        // Core counts
        totalBookings: totalBookings || 0,
        completedBookings: completedBookings || 0,
        cancelledBookings: cancelledBookings || 0,
        noShowBookings: noShowBookings || 0,
        
        // Financial metrics
        totalRevenue: totalRevenue || 0,
        commissionEarned: commissionEarned || 0,
        averageBookingValue: completedBookings > 0 ? 
          Math.round(totalRevenue / completedBookings) : 0,
        
        // Performance ratios
        completionRate: completionRate || 0,
        cancellationRate: cancellationRate || 0,
        noShowRate: totalBookings > 0 ? 
          Math.round((noShowBookings / totalBookings) * 100) : 0,
        
        // Quality metrics
        averageRating: Math.round(averageRating * 10) / 10 || 0,
        performanceScore: performanceScore || 0,
        
        // Trending data
        monthlyStats: monthlyStats || {},
        topServices: topServiceDetails || []
      },
      period: {
        type: period,
        year: year,
        month: period === 'month' ? month : null,
        label: period === 'month' ? 
          format(new Date(year, month - 1), 'MMMM yyyy') :
          period === 'year' ? year.toString() : 'All time'
      },
      business: ctx.business
    });
  } catch (err) {
    Sentry.captureException?.(err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}