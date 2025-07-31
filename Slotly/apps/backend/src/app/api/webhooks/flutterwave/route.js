import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { PrismaClient } from '@/generated/prisma';
import { verifyTransactionWebhook } from '@/lib/shared/flutterwave';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const event = await verifyTransactionWebhook(request);

    if (event.event !== 'charge.completed') {
      return NextResponse.json({ message: 'Ignored non-payment event' }, { status: 200 });
    }

    const txRef = event.data.tx_ref;
    const status = event.data.status;

    if (status !== 'successful') {
      console.warn(`❌ Transaction ${txRef} not successful`);
      return NextResponse.json({ message: 'Ignored unsuccessful transaction' }, { status: 200 });
    }

    
    if (txRef.startsWith('booking-')) {
      const bookingId = txRef.replace('booking-', '');

      await prisma.payment.updateMany({
        where: { bookingId, status: 'PENDING' },
        data: { status: 'SUCCESS' },
      });

      return NextResponse.json({ message: `✅ Booking payment confirmed for ${bookingId}` }, { status: 200 });
    }

    
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
           businessId: businessId,
          amount: Number(event.data.amount),
          method: event.data.payment_type?.toUpperCase() || 'OTHER',
          status: 'SUCCESS',
          fee: Number(event.data.app_fee || 0),
          createdAt: new Date(event.data.created_at),
        },
      });

      return NextResponse.json({ message: `✅ Subscription payment recorded for business ${businessId}` }, { status: 200 });
    }

    return NextResponse.json({ message: 'Unhandled transaction reference' }, { status: 200 });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
