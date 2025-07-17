import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';
import '@/sentry.server.config';
import * as Sentry from '@sentry/nextjs';

const prisma = new PrismaClient();

export async function POST(request, { params }) {
  const bookingId = params.id;

  try {
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
    const cutoffTime = new Date(booking.startTime);
    cutoffTime.setMinutes(cutoffTime.getMinutes() - booking.business.cancellationDeadlineMinutes);

    const isLate = now > cutoffTime;

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CANCELLED',
        payment: isLate
          ? {
              create: {
                amount: booking.business.lateCancellationFee,
                method: 'OTHER',
                status: 'PENDING',
                fee: 0,
              },
            }
          : undefined,
      },
    });

    return NextResponse.json({
      message: `Booking cancelled${isLate ? ' with late fee' : ''}`,
      updatedBooking,
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
