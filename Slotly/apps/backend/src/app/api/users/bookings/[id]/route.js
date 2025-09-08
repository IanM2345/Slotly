import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';
import * as Sentry from '@sentry/nextjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const prisma = globalThis._prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalThis._prisma = prisma;

const json = (d, s = 200) => NextResponse.json(d, { status: s });
const isId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

// Keep the same rules your collection route uses
function extractUserId(decoded) {
  return (
    decoded.userId ??
    decoded.id ??
    decoded.sub ??
    decoded._id ??
    decoded.user_id ??
    decoded.user?.id ??
    decoded.user?.userId ??
    null
  );
}

// OPTIONAL: same transform you use elsewhere (keeps imageUrl stable)
function transformBooking(booking) {
  if (!booking?.service) return booking;
  const imageUrl = booking.service.serviceImages?.[0]?.url ?? null;
  return {
    ...booking,
    service: { ...booking.service, imageUrl, serviceImages: undefined },
  };
}

async function getMe(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const { valid, decoded } = await verifyToken(token);
  if (!valid || !decoded || decoded.role !== 'CUSTOMER') return null;
  return { id: extractUserId(decoded) };
}

/** ------------------ CANCEL (DELETE /api/users/bookings/:id) ------------------ */
export async function DELETE(request, ctx) {
  try {
    const { id: bookingId } = await ctx.params; // ✅ must await in App Router
    if (!isId(bookingId)) return json({ error: 'Invalid booking id' }, 400);

    const me = await getMe(request);
    if (!me?.id) return json({ error: 'Unauthorized' }, 401);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: { 
          select: { 
            id: true, 
            name: true, 
            duration: true, 
            price: true,
            serviceImages: { 
              select: { url: true }, 
              take: 1, 
              orderBy: { createdAt: 'desc' } 
            } 
          } 
        },
        business: true,
        payments: true,
        reminder: true,
      },
    });
    
    if (!booking || booking.userId !== me.id) {
      return json({ error: 'Booking not found' }, 404);
    }
    
    if (booking.status === 'CANCELLED') {
      return json({ message: 'Already cancelled', booking: transformBooking(booking) });
    }

    // Enforce your 2-hour rule: cannot cancel <= 2h before start
    const cutoffMins = booking.cancellationDeadlineMinutes ?? 120;
    const cutoff = new Date(booking.startTime);
    cutoff.setMinutes(cutoff.getMinutes() - cutoffMins);
    const isTooLate = new Date() > cutoff;
    
    if (isTooLate) {
      return json({ error: 'Too late to cancel. You can only cancel more than 2 hours before start.' }, 400);
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED', cancelReason: 'User cancelled' },
      include: {
        service: { 
          select: { 
            id: true, 
            name: true, 
            duration: true, 
            price: true,
            serviceImages: { 
              select: { url: true }, 
              take: 1, 
              orderBy: { createdAt: 'desc' } 
            } 
          } 
        },
        business: true,
        payments: true,
        reminder: true,
      },
    });

    return json({ message: 'Booking cancelled.', booking: transformBooking(updated) });
  } catch (err) {
    console.error('Error cancelling booking:', err);
    Sentry.captureException(err);
    return json({ error: 'Internal Server Error' }, 500);
  }
}

/** --------------- RESCHEDULE (PATCH /api/users/bookings/:id) ----------------- */
export async function PATCH(request, ctx) {
  try {
    const { id: bookingId } = await ctx.params;
    if (!isId(bookingId)) return json({ error: 'Invalid booking id' }, 400);

    const me = await getMe(request);
    if (!me?.id) return json({ error: 'Unauthorized' }, 401);

    const body = await request.json().catch(() => ({}));
    const { startTime, endTime, durationMinutes } = body;
    if (!startTime) return json({ error: 'startTime is required' }, 400);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: { 
          select: { 
            id: true, 
            name: true, 
            duration: true, 
            price: true,
            serviceImages: { 
              select: { url: true }, 
              take: 1, 
              orderBy: { createdAt: 'desc' } 
            } 
          } 
        },
        business: true,
        payments: true,
        reminder: true,
      },
    });
    
    if (!booking || booking.userId !== me.id) {
      return json({ error: 'Booking not found' }, 404);
    }
    
    if (['CANCELLED', 'COMPLETED'].includes(booking.status)) {
      return json({ error: 'Cannot reschedule this booking' }, 400);
    }

    const newStart = new Date(startTime);
    if (Number.isNaN(newStart.getTime())) {
      return json({ error: 'Invalid startTime' }, 400);
    }
    
    if (newStart <= new Date()) {
      return json({ error: 'Start time must be in the future' }, 400);
    }

    let newEnd = endTime ? new Date(endTime) : null;
    if (newEnd && Number.isNaN(newEnd.getTime())) {
      return json({ error: 'Invalid endTime' }, 400);
    }
    
    if (!newEnd) {
      const dur = Number(durationMinutes ?? booking.service?.duration ?? 60);
      if (dur <= 0) return json({ error: 'Invalid duration' }, 400);
      newEnd = new Date(newStart.getTime() + dur * 60000);
    }
    
    if (newEnd <= newStart) {
      return json({ error: 'End time must be after start time' }, 400);
    }

    // Overlap guard (same business+service, active statuses)
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

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: { 
        startTime: newStart, 
        endTime: newEnd, 
        status: 'RESCHEDULED' 
      },
      include: {
        service: { 
          select: { 
            id: true, 
            name: true, 
            duration: true, 
            price: true,
            serviceImages: { 
              select: { url: true }, 
              take: 1, 
              orderBy: { createdAt: 'desc' } 
            } 
          } 
        },
        business: true,
        payments: true,
        reminder: true,
      },
    });

    return json({ message: 'Booking rescheduled successfully', booking: transformBooking(updated) });
  } catch (err) {
    console.error('Error rescheduling booking:', err);
    Sentry.captureException(err);
    return json({ error: 'Internal Server Error' }, 500);
  }
}