import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { initiateSplitPayment } from '@/lib/shared/flutterwave';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const { bookingId } = await request.json();
    if (!bookingId) {
      return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: true,
        service: true, // <-- load service to get price
        business: { include: { PayoutSettings: true } }
      }
    });

    if (!booking || !booking.business || !booking.user) {
      return NextResponse.json({ error: 'Invalid booking' }, { status: 404 });
    }

    const { PayoutSettings: settings } = booking.business;
    if (!settings || !settings.flwSubaccountId) {
      return NextResponse.json({ error: 'Payout settings not configured' }, { status: 500 });
    }

    const amount = Number(booking.service?.price ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid service price' }, { status: 400 });
    }

    // Prepare the customer object for Flutterwave
    const customer = {
      email: booking.user.email || undefined,
      name: booking.user.name || undefined,
      phone_number: booking.user.phone || undefined,
    };

    // 1) Create a Payment row first (PENDING)
    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        amount,
        method: 'CARD_OR_MPESA',    // source-of-truth on server
        status: 'PENDING',
        fee: 0,
      }
    });

    // 2) Initiate provider checkout link (pass your internal payment.id as reference if supported)
    const paymentLink = await initiateSplitPayment({
      amount,
      customer,
      businessSubAccountId: settings.flwSubaccountId,
      // Optional but recommended: internal reference to map webhooks back
      reference: payment.id,
      // You can also pass a redirect/callback URL if your flow supports it
    });

    // 3) Persist checkout link for traceability (optional but useful)
    await prisma.payment.update({
      where: { id: payment.id },
      data: { checkoutLink: paymentLink }
    });

    return NextResponse.json({ link: paymentLink, paymentId: payment.id }, { status: 200 });

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
