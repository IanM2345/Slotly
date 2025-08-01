import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyTransactionWebhook } from '@/lib/shared/flutterwave';
import { PrismaClient } from '@/generated/prisma';

const prisma = globalThis.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}


export async function POST(request) {
  try {
    const event = await verifyTransactionWebhook(request);
    const txRef = event.data.tx_ref;
    const status = event.data.status;

    if (event.event !== 'charge.completed') {
      return NextResponse.json({ message: 'Ignored non-payment event' }, { status: 200 });
    }

    if (status !== 'successful') {
      console.warn(`❌ Transaction ${txRef} not successful`);
      return NextResponse.json({ message: 'Ignored unsuccessful transaction' }, { status: 200 });
    }

    // ✅ Idempotency check
    const existing = await prisma.webhookLog.findUnique({ where: { txRef } });
    if (existing) {
      console.log(`ℹ️ Already processed tx_ref: ${txRef}`);
      return NextResponse.json({ message: 'Already processed' }, { status: 200 });
    }

    // ✅ Booking payment handler
    if (txRef.startsWith('booking-')) {
      const bookingId = txRef.replace('booking-', '');

      await prisma.payment.updateMany({
        where: { bookingId, status: 'PENDING' },
        data: { status: 'SUCCESS' },
      });

      await prisma.webhookLog.create({
        data: { txRef, type: 'BOOKING' },
      });

      return NextResponse.json(
        { message: `✅ Booking payment confirmed for ${bookingId}` },
        { status: 200 }
      );
    }

    // ✅ Subscription payment handler
    if (txRef.startsWith('subscription-')) {
      const [, businessId] = txRef.split('-');

      const now = new Date();
      const end = new Date();
      end.setMonth(end.getMonth() + 1);

      await prisma.subscription.updateMany({
        where: { businessId },
        data: {
          startDate: now,
          endDate: end,
          isActive: true,
        },
      });

      await prisma.payment.create({
        data: {
          bookingId: null,
          businessId,
          amount: Number(event.data.amount),
          method: event.data.payment_type?.toUpperCase() || 'OTHER',
          status: 'SUCCESS',
          fee: Number(event.data.app_fee || 0),
          createdAt: new Date(event.data.created_at),
        },
      });

      await prisma.webhookLog.create({
        data: { txRef, type: 'SUBSCRIPTION' },
      });

      return NextResponse.json(
        { message: `✅ Subscription payment recorded for business ${businessId}` },
        { status: 200 }
      );
    }

    return NextResponse.json({ message: 'Unhandled transaction reference' }, { status: 200 });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
