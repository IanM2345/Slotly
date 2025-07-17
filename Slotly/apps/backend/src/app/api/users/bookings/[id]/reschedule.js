import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';
import '@/sentry.server.config';
import * as Sentry from '@sentry/nextjs';

const prisma = new PrismaClient();

export async function PATCH(request, { params }) {
  try {
    const bookingId = params.id;
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);

    if (!valid || !decoded || decoded.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = decoded.id;

    const { newStartTime, newEndtime } = await request.json();

    const booking = await prisma.booking.findUnique({
      where: {
        id: bookingId,
        userId: userId,
      },
      include: {
        business: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const now = new Date();
    const cancellationDeadline = new Date(booking.startTime);
    cancellationDeadline.setMinutes(
      cancellationDeadline.getMinutes() - (booking.business.cancellationDeadlineMinutes || 120)
    );

    if (now > cancellationDeadline) {
      return NextResponse.json(
        {
          error: 'Cannot reschedule booking within cancellation deadline',
          lateFee: booking.business.lateCancellationFee || 500,
        },
        { status: 403 }
      );
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        startTime: new Date(newStartTime),
        endTime: new Date(newEndtime),
        status: 'RESCHEDULED',
      },
      include: {
        service: true,
        business: true,
        payment: true,
        reminder: true,
      },
    });

    return NextResponse.json(
      {
        message: 'Booking rescheduled successfully',
        updatedBooking,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error rescheduling booking:', error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
