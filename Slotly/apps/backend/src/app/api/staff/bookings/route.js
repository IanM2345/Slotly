// apps/backend/src/app/api/staff/bookings/route.js
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { getStaffContext } from '../route';

export const dynamic = 'force-dynamic';

// Reuse Prisma in dev
const prisma = globalThis._prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalThis._prisma = prisma;

/**
 * PATCH /api/staff/bookings?id=<bookingId>
 * Body: { action: "complete" | "no_show" }
 *
 * - Ensures the booking belongs to the authenticated staff and active business
 * - Prevents changes to final states (CANCELLED, COMPLETED, NO_SHOW)
 * - Stamps completedAt / noShowAt and markedById
 */
export async function PATCH(request) {
  try {
    const ctx = await getStaffContext(request);
    if (ctx?.error) return ctx.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Booking id is required' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || '').toLowerCase();

    if (!['complete', 'no_show'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Use "complete" or "no_show".' }, { status: 400 });
    }

    // Make sure this booking is assigned to this staff and within the same business
    const booking = await prisma.booking.findFirst({
      where: { id, staffId: ctx.userId, businessId: ctx.business.id },
      select: {
        id: true,
        status: true,
        startTime: true,
        endTime: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Block updates to final states
    const FINAL = new Set(['CANCELLED', 'COMPLETED', 'NO_SHOW']);
    if (FINAL.has(booking.status)) {
      return NextResponse.json(
        { error: `Cannot modify a ${booking.status} booking` },
        { status: 400 }
      );
    }

    const now = new Date();

    // Allowed transitions:
    //  - PENDING/CONFIRMED/RESCHEDULED -> COMPLETED
    //  - PENDING/CONFIRMED/RESCHEDULED -> NO_SHOW
    // (You can tighten rules here if you only want to allow after endTime, etc.)
    const data =
      action === 'complete'
        ? { status: 'COMPLETED', completedAt: now, markedById: ctx.userId }
        : { status: 'NO_SHOW', noShowAt: now, markedById: ctx.userId };

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data,
      include: {
        user: { select: { id: true, name: true, phone: true } },
        service: { select: { id: true, name: true, price: true, duration: true } },
      },
    });

    return NextResponse.json({
      ok: true,
      message: action === 'complete' ? 'Booking marked as completed' : 'Booking marked as no-show',
      booking: updated,
    });
  } catch (err) {
    Sentry.captureException?.(err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
