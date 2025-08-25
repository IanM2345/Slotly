// File: apps/backend/src/app/api/staff/earnings/route.js
// Staff earnings and commission tracking endpoint

import * as Sentry from '@sentry/nextjs';
import { PrismaClient } from '@/generated/prisma';
import { NextResponse } from 'next/server';
import { getStaffContext } from '../route';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format } from 'date-fns';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const ctx = await getStaffContext(request);
    if (ctx?.error) return ctx.response;

    const url = new URL(request.url);
    const period = url.searchParams.get('period') || 'month'; // 'week', 'month', 'year'
    const year = parseInt(url.searchParams.get('year') || new Date().getFullYear());
    const month = parseInt(url.searchParams.get('month') || new Date().getMonth() + 1);

    let startDate, endDate;
    
    if (period === 'week') {
      const weekStart = startOfWeek(new Date());
      startDate = weekStart;
      endDate = endOfWeek(new Date());
    } else if (period === 'month') {
      startDate = startOfMonth(new Date(year, month - 1));
      endDate = endOfMonth(new Date(year, month - 1));
    } else if (period === 'year') {
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31, 23, 59, 59);
    }

    const dateFilter = startDate ? {
      createdAt: { gte: startDate, lte: endDate }
    } : {};

    // Get payment data for completed bookings
    const payments = await prisma.payment.findMany({
      where: {
        status: 'SUCCESS',
        ...dateFilter,
        booking: {
          staffId: ctx.userId,
          businessId: ctx.business.id,
          status: 'COMPLETED'
        }
      },
      include: {
        booking: {
          include: {
            service: { select: { name: true, category: true } },
            user: { select: { name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate earnings
    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    const commissionRate = 0.1; // 10% commission
    const totalCommission = Math.round(totalRevenue * commissionRate);
    const platformFees = payments.reduce((sum, p) => sum + (p.fee || 0), 0);

    // Group by service category
    const categoryBreakdown = payments.reduce((acc, payment) => {
      const category = payment.booking.service.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = { revenue: 0, bookings: 0, commission: 0 };
      }
      acc[category].revenue += payment.amount;
      acc[category].bookings += 1;
      acc[category].commission += Math.round(payment.amount * commissionRate);
      return acc;
    }, {});

    // Daily breakdown for charts
    const dailyBreakdown = payments.reduce((acc, payment) => {
      const day = format(payment.createdAt, 'yyyy-MM-dd');
      if (!acc[day]) {
        acc[day] = { revenue: 0, bookings: 0, commission: 0 };
      }
      acc[day].revenue += payment.amount;
      acc[day].bookings += 1;
      acc[day].commission += Math.round(payment.amount * commissionRate);
      return acc;
    }, {});

    // Recent transactions
    const recentTransactions = payments.slice(0, 10).map(payment => ({
      id: payment.id,
      amount: payment.amount,
      commission: Math.round(payment.amount * commissionRate),
      serviceName: payment.booking.service.name,
      customerName: payment.booking.user.name,
      date: payment.createdAt,
      method: payment.method
    }));

    // Calculate growth compared to previous period
    let growthData = null;
    if (period !== 'all') {
      let prevStartDate, prevEndDate;
      
      if (period === 'week') {
        prevStartDate = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        prevEndDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (period === 'month') {
        prevStartDate = startOfMonth(new Date(year, month - 2));
        prevEndDate = endOfMonth(new Date(year, month - 2));
      } else if (period === 'year') {
        prevStartDate = new Date(year - 1, 0, 1);
        prevEndDate = new Date(year - 1, 11, 31, 23, 59, 59);
      }

      const prevRevenue = await prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          status: 'SUCCESS',
          createdAt: { gte: prevStartDate, lte: prevEndDate },
          booking: {
            staffId: ctx.userId,
            businessId: ctx.business.id,
            status: 'COMPLETED'
          }
        }
      });

      const prevTotal = prevRevenue._sum.amount || 0;
      const revenueGrowth = prevTotal > 0 ? 
        Math.round(((totalRevenue - prevTotal) / prevTotal) * 100) : 0;

      growthData = {
        revenueGrowth,
        previousPeriodRevenue: prevTotal
      };
    }

    return NextResponse.json({
      summary: {
        totalRevenue: totalRevenue || 0,
        totalCommission: totalCommission || 0,
        platformFees: platformFees || 0,
        netEarnings: totalCommission - platformFees || 0,
        totalBookings: payments.length || 0,
        averageBookingValue: payments.length > 0 ? 
          Math.round(totalRevenue / payments.length) : 0,
        commissionRate: commissionRate * 100
      },
      breakdowns: {
        byCategory: categoryBreakdown || {},
        byDay: dailyBreakdown || {}
      },
      recentTransactions: recentTransactions || [],
      growth: growthData,
      period: {
        type: period,
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
        label: period === 'month' ? 
          format(new Date(year, month - 1), 'MMMM yyyy') :
          period === 'year' ? year.toString() :
          period === 'week' ? 'This Week' : 'All Time'
      },
      business: ctx.business
    });
  } catch (err) {
    Sentry.captureException?.(err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}