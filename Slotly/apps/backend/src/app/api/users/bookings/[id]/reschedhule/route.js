// apps/backend/src/app/api/users/bookings/[id]/reschedule/route.js
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';
import * as Sentry from '@sentry/nextjs';

const prisma = globalThis._prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalThis._prisma = prisma;
const json = (d, s = 200) => NextResponse.json(d, { status: s });
const isId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

async function getUser(request) {
  try {
    const header = request.headers.get('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    const result = token ? await verifyToken(token) : await verifyToken(request);
    return result?.valid ? result.decoded : null;
  } catch (err) {
    return null;
  }
}

export async function PATCH(request, ctx) {
  try {
    const { id: bookingId } = await ctx.params;
    if (!isId(bookingId)) {
      return json({ error: 'Invalid booking id' }, 400);
    }

    const me = await getUser(request);
    if (!me || me.role !== 'CUSTOMER') {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = await request.json().catch(() => ({}));
    const { startTime, endTime, durationMinutes } = body;

    if (!startTime) {
      return json({ error: 'startTime is required' }, 400);
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { service: true, business: true },
    });
    
    if (!booking || booking.userId !== me.id) {
      return json({ error: 'Booking not found' }, 404);
    }

    // Check if booking can be rescheduled
    if (booking.status === 'CANCELLED') {
      return json({ error: 'Cannot reschedule a cancelled booking' }, 400);
    }
    
    if (booking.status === 'COMPLETED') {
      return json({ error: 'Cannot reschedule a completed booking' }, 400);
    }

    // Compute new times
    const newStart = new Date(startTime);
    if (Number.isNaN(newStart.getTime())) {
      return json({ error: 'Invalid startTime format' }, 400);
    }

    // Ensure the new start time is in the future
    if (newStart <= new Date()) {
      return json({ error: 'Start time must be in the future' }, 400);
    }

    let newEnd = endTime ? new Date(endTime) : null;
    if (newEnd && Number.isNaN(newEnd.getTime())) {
      return json({ error: 'Invalid endTime format' }, 400);
    }
    
    if (!newEnd) {
      const dur = Number(durationMinutes ?? booking.service?.duration ?? 60);
      if (dur <= 0) {
        return json({ error: 'Invalid duration' }, 400);
      }
      newEnd = new Date(newStart.getTime() + dur * 60000);
    }

    // Validate time range
    if (newEnd <= newStart) {
      return json({ error: 'End time must be after start time' }, 400);
    }

    // Prevent overlaps: same service & business, overlapping window
    const overlap = await prisma.booking.count({
      where: {
        id: { not: booking.id },
        serviceId: booking.serviceId,
        businessId: booking.businessId,
        status: { in: ['PENDING', 'CONFIRMED', 'RESCHEDULED'] },
        startTime: { lt: newEnd },
        endTime: { gt: newStart },
      },
    });
    
    if (overlap > 0) {
      return json({ error: 'Selected time is no longer available' }, 409);
    }

    // Check business hours if available
    // This is optional - you can add business hours validation here
    
    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: { 
        startTime: newStart, 
        endTime: newEnd, 
        status: 'RESCHEDULED',
        updatedAt: new Date()
      },
      include: { service: true, business: true },
    });

    return json({ 
      message: 'Booking rescheduled successfully', 
      booking: updated 
    });
  } catch (err) {
    Sentry.captureException(err);
    console.error('Reschedule booking error:', err);
    return json({ error: 'Internal Server Error' }, 500);
  }
}