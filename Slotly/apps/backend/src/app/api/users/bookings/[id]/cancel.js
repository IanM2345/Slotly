// app/api/bookings/[id]/cancel/route.js
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';
import { refundPayment, createPaymentCheckout } from '@/lib/shared/intasend';

const prisma = new PrismaClient();

/**
 * Policy:
 * - Not late:
 *     If there is a successful app payment for this booking, refund it first.
 *     Only mark CANCELLED after refund succeeds.
 * - Late:
 *     Create a CANCELLATION fee payment (IntaSend checkout) and return checkoutUrl.
 *     Do NOT mark CANCELLED now; webhook will finalize on fee success.
 */
export async function POST(request, { params }) {
  const bookingId = params.id;

  try {
    // Auth (consistent with your other routes)
    const { valid, decoded, error } = await verifyToken(request);
    if (!valid || !decoded || decoded.role !== 'CUSTOMER') {
      return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
    }
    const userId = decoded.id;

    // Load booking + related bits
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { business: true, service: true },
    });
    if (!booking || booking.userId !== userId) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Idempotency: already cancelled?
    if (booking.status === 'CANCELLED') {
      return NextResponse.json({ message: 'Already cancelled' }, { status: 200 });
    }

    // Compute lateness using Booking fields (not business)
    const cutoffMins = booking.cancellationDeadlineMinutes ?? 120;
    const cutoff = new Date(booking.startTime);
    cutoff.setMinutes(cutoff.getMinutes() - cutoffMins);
    const isLate = new Date() > cutoff;

    // Most recent successful app payment we might refund
    const paid = await prisma.payment.findFirst({
      where: {
        bookingId: booking.id,
        status: 'SUCCESS',
        type: 'BOOKING',
        provider: 'INTASEND',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (isLate) {
      // LATE CANCELLATION → collect fee first
      const feeAmount = booking.lateCancellationFee ?? 5000; // your schema default is 5000 (KES)

      const txRef = `cancellation-${booking.id}-${Date.now()}`;
      const payment = await prisma.payment.create({
        data: {
          type: 'CANCELLATION',
          bookingId: booking.id,
          businessId: booking.businessId,
          amount: feeAmount,       // Int in KES as per your schema
          method: 'OTHER',         // finalize via webhook
          status: 'PENDING',
          provider: 'INTASEND',
          txRef,
        },
      });

      const checkout = await createPaymentCheckout({
        amount: feeAmount,
        currency: 'KES',
        email: null, // optionally look up the user's email if desired
        name: 'Slotly Customer',
        phone: undefined,
        reference: txRef,
        redirect_url: `${process.env.PUBLIC_APP_URL}/cancellation/success`,
        cancel_url: `${process.env.PUBLIC_APP_URL}/cancellation/cancel`,
        metadata: {
          bookingId: booking.id,
          businessId: booking.businessId,
          purpose: 'CANCELLATION_FEE',
          paymentId: payment.id,
        },
      });

      const checkoutUrl = checkout?.checkout_url || checkout?.url || null;
      const invoiceId = checkout?.invoice_id || checkout?.invoice || null;

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerPaymentId: invoiceId ?? undefined, // store invoice id for later verification/refund if needed
          checkoutLink: checkoutUrl ?? undefined,
        },
      });

      // Do NOT cancel yet — webhook marks payment SUCCESS then sets booking CANCELLED
      return NextResponse.json(
        {
          message: 'Late cancellation fee required. Complete payment to finalize cancellation.',
          requiresAction: true,
          action: 'PAY_CANCELLATION_FEE',
          checkoutUrl,
          reference: txRef,
          invoiceId,
        },
        { status: 200 }
      );
    }

    // NOT LATE → if there’s a paid app payment, refund it first
    if (paid?.providerPaymentId) {
      try {
        // Our IntaSend wrapper should expect invoice_id under the hood.
        await refundPayment({
          providerPaymentId: paid.providerPaymentId, // invoice_id stored earlier
          amount: paid.amount,                       // full refund (adjust for partials if needed)
          reason: `Refund for cancellation: booking ${booking.id}`,
        });

        // Mark that payment as REFUNDED (idempotent if already done)
        await prisma.payment.update({
          where: { id: paid.id },
          data: { status: 'REFUNDED' },
        });
      } catch (err) {
        console.error('Refund failed:', err?.response?.data || err?.message);
        Sentry.captureException(err);
        return NextResponse.json(
          { error: 'We could not process the refund at this time. Please try again later.' },
          { status: 502 }
        );
      }
    }

    // Either no app payment was found, or the refund succeeded → finalize cancellation
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED' },
    });

    return NextResponse.json(
      {
        message: paid ? 'Booking cancelled and refunded.' : 'Booking cancelled.',
        updatedBooking,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error cancelling booking:', error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
