import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { initiateSplitPayment } from '@/lib/shared/flutterwave';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const data = await request.json();
    const { bookingId } = data;

    if (!bookingId) {
      return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: true,
        business: {
          include: { PayoutSettings: true }
        }
      }
    });

    if (!booking || !booking.business || !booking.user) {
      return NextResponse.json({ error: 'Invalid booking' }, { status: 404 });
    }

    const customer = {
      email: booking.user.email,
      name: booking.user.name,
      phone_number: booking.user.phone,
    };

    const settings = booking.business.PayoutSettings;
    const amount = booking.service?.price || 1000;

    if (!settings || !settings.flwSubaccountId) {
      return NextResponse.json({ error: 'Payout settings not configured' }, { status: 500 });
    }

    const paymentLink = await initiateSplitPayment({
      amount,
      customer,
      businessSubAccountId: settings.flwSubaccountId,
    });

    return NextResponse.json({ link: paymentLink }, { status: 200 });

  } catch (error) {
    Sentry.captureException(error);
    console.error('Payment init error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get('bookingId');

    if (!bookingId) {
      return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 });
    }

    const payments = await prisma.payment.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(payments, { status: 200 });
  } catch (error) {
    Sentry.captureException?.(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
