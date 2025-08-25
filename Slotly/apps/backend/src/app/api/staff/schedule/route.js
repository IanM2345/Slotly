// File: apps/backend/src/app/api/staff/schedule/route.js
// Staff booking schedule and appointments endpoint

import * as Sentry from '@sentry/nextjs';
import { PrismaClient } from '@/generated/prisma';
import { NextResponse } from 'next/server';
import { getStaffContext } from '../route';
import { startOfDay, endOfDay } from 'date-fns';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const ctx = await getStaffContext(request);
    if (ctx?.error) return ctx.response;

    const url = new URL(request.url);
    const upcoming = url.searchParams.get('upcoming') === 'true';
    const dateParam = url.searchParams.get('date'); // YYYY-MM-DD
    const status = url.searchParams.get('status');  // EXACT status if provided
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const where = {
      staffId: ctx.userId,
      businessId: ctx.business.id,
    };

    if (upcoming) {
      where.startTime = { gte: new Date() };
    }

    if (status) {
      where.status = status.toUpperCase();
    }

    if (dateParam) {
      const targetDate = new Date(dateParam);
      where.startTime = {
        gte: startOfDay(targetDate),
        lte: endOfDay(targetDate)
      };
    }

    const [bookings, totalCount] = await Promise.all([
      prisma.booking.findMany({
        where,
        orderBy: { startTime: 'asc' },
        take: limit,
        skip: offset,
        include: {
          user: { select: { id: true, name: true, phone: true, email: true } },
          service: { 
            select: { 
              id: true, 
              name: true, 
              duration: true, 
              price: true, 
              category: true 
            } 
          },
          business: {
            select: { id: true, name: true, logoUrl: true }
          }
        },
      }),
      prisma.booking.count({ where })
    ]);

    // Calculate schedule statistics
    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);

    const todayBookings = await prisma.booking.count({
      where: {
        staffId: ctx.userId,
        businessId: ctx.business.id,
        startTime: { gte: todayStart, lte: todayEnd }
      }
    });

    const upcomingBookings = await prisma.booking.count({
      where: {
        staffId: ctx.userId,
        businessId: ctx.business.id,
        startTime: { gt: new Date() },
        status: { in: ['PENDING', 'CONFIRMED'] }
      }
    });

    const stats = {
      today: todayBookings,
      upcoming: upcomingBookings,
      total: totalCount,
      loaded: bookings.length
    };

    return NextResponse.json({ 
      bookings: bookings || [],
      stats,
      business: ctx.business,
      pagination: {
        limit,
        offset,
        total: totalCount,
        hasMore: offset + bookings.length < totalCount
      }
    });
  } catch (err) {
    Sentry.captureException?.(err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Mark booking as completed, no-show, etc.
export async function PUT(request) {
  try {
    const ctx = await getStaffContext(request);
    if (ctx?.error) return ctx.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing booking id' }, { status: 400 });

    const payload = await request.json().catch(() => ({}));
    const { status, notes } = payload;

    if (!status || !['COMPLETED', 'NO_SHOW', 'CANCELLED'].includes(status)) {
      return NextResponse.json({ 
        error: 'Invalid status. Must be COMPLETED, NO_SHOW, or CANCELLED' 
      }, { status: 400 });
    }

    const updateData = { status };
    
    if (status === 'COMPLETED') {
      updateData.completedAt = new Date();
      updateData.markedById = ctx.userId;
    } else if (status === 'NO_SHOW') {
      updateData.noShowAt = new Date();
      updateData.markedById = ctx.userId;
    } else if (status === 'CANCELLED' && notes) {
      updateData.cancelReason = notes;
    }

    const booking = await prisma.booking.updateMany({
      where: {
        id,
        staffId: ctx.userId,
        businessId: ctx.business.id,
        status: { in: ['PENDING', 'CONFIRMED'] } // Only allow updates from these statuses
      },
      data: updateData
    });

    if (!booking.count) {
      return NextResponse.json({ 
        error: 'Booking not found or cannot be updated' 
      }, { status: 404 });
    }

    return NextResponse.json({ ok: true, updated: booking.count });
  } catch (err) {
    Sentry.captureException?.(err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}