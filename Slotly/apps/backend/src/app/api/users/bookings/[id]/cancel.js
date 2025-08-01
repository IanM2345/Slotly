import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';
import * as Sentry from '@sentry/nextjs';
import { initiateCancellationFee } from '@/lib/shared/flutterwave';

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
      },
      include: {
        business: true,
        service: true,
        user: true,
      },
    });

    if (!booking || booking.userId !== userId) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const now = new Date();
    const deadline = new Date(booking.startTime);
    deadline.setMinutes(deadline.getMinutes() - (booking.business.cancellationDeadlineMinutes || 120));

    const isLate = now > deadline;

   
    if (isLate) {
      try {
        await initiateCancellationFee({
          businessId: booking.businessId,
          amount: booking.business.lateCancellationFee || 200,
          customer: {
            name: booking.user.name,
            email: booking.user.email,
            phone_number: booking.user.phone || undefined,
          },
        });
      } catch (error) {
        console.error('Failed to trigger late fee payment:', err);
        Sentry.captureException(error);
        return NextResponse.json({
          error: 'Failed to process cancellation fee. Please try again.',
        }, { status: 502 });
      }
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED' },
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
