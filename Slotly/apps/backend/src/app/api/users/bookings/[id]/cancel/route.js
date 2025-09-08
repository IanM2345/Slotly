// apps/backend/src/app/api/users/bookings/[id]/cancel/route.js
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';
import { refundPayment, createPaymentCheckout } from '@/lib/shared/intasend';

const prisma = globalThis._prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalThis._prisma = prisma;

const json = (data, status = 200) => NextResponse.json(data, { status });
const isId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

async function getUserFromRequest(request) {
  try {
    // Accept either Authorization: Bearer <token> or cookie handled in verifyToken(request)
    const header = request.headers.get('authorization');
    if (header?.startsWith('Bearer ')) {
      const token = header.slice(7);
      const { valid, decoded, error } = await verifyToken(token);
      if (!valid) {
        return { error: error || 'Invalid token' };
      }
      return decoded;
    }
    
    // Fallback to request-based verification (cookies)
    const { valid, decoded, error } = await verifyToken(request);
    if (!valid) {
      return { error: error || 'Unauthorized' };
    }
    return decoded;
  } catch (err) {
    return { error: 'Authentication failed' };
  }
}

export async function POST(request, ctx) {
  try {
    const { id: bookingId } = await ctx.params;
    if (!isId(bookingId)) {
      return json({ error: 'Invalid booking id' }, 400);
    }

    const user = await getUserFromRequest(request);
    if (!user || user.error) {
      return json({ error: user?.error || 'Unauthorized' }, 401);
    }
    
    if (user.role !== 'CUSTOMER') {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = await request.json().catch(() => ({}));
    const cancelReason = body?.reason || 'User cancelled';

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { service: true, business: true, payments: true },
    });
    
    if (!booking || booking.userId !== user.id) {
      return json({ error: 'Booking not found' }, 404);
    }
    
    if (booking.status === 'CANCELLED') {
      return json({ message: 'Already cancelled' });
    }

    // 2-hour rule (or per-booking setting)
    const cutoffMins = booking.cancellationDeadlineMinutes ?? 120;
    const cutoff = new Date(booking.startTime);
    cutoff.setMinutes(cutoff.getMinutes() - cutoffMins);
    const isLate = new Date() > cutoff;

    // Latest successful booking payment (if any)
    const paid = await prisma.payment.findFirst({
      where: { bookingId: booking.id, status: 'SUCCESS', type: 'BOOKING' },
      orderBy: { createdAt: 'desc' },
    });

    if (isLate) {
      // Late cancellation - require fee payment
      const feeAmount = booking.lateCancellationFee ?? 5000; // KES
      const txRef = `cancellation-${booking.id}-${Date.now()}`;

      const payment = await prisma.payment.create({
        data: {
          type: 'CANCELLATION',
          bookingId: booking.id,
          businessId: booking.businessId,
          amount: feeAmount,
          method: 'OTHER',
          status: 'PENDING',
          provider: 'INTASEND',
          txRef,
        },
      });

      try {
        const checkout = await createPaymentCheckout({
          amount: feeAmount,
          currency: 'KES',
          reference: txRef,
          redirect_url: `${process.env.PUBLIC_APP_URL}/cancellation/success`,
          cancel_url: `${process.env.PUBLIC_APP_URL}/cancellation/cancel`,
          metadata: { bookingId: booking.id, paymentId: payment.id, purpose: 'CANCELLATION_FEE' },
        });

        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            providerPaymentId: checkout?.invoice_id || checkout?.invoice || undefined,
            checkoutLink: checkout?.checkout_url || checkout?.url || undefined,
          },
        });

        // Do NOT mark CANCELLED yet — webhook will mark payment SUCCESS then set booking CANCELLED
        return json({
          message: 'Late cancellation fee required. Complete payment to finalize cancellation.',
          requiresAction: true,
          action: 'PAY_CANCELLATION_FEE',
          checkoutUrl: checkout?.checkout_url || checkout?.url || null,
          reference: txRef,
        });
      } catch (checkoutError) {
        Sentry.captureException(checkoutError);
        // Clean up the payment record if checkout creation failed
        await prisma.payment.delete({ where: { id: payment.id } });
        return json({ error: 'Failed to create payment checkout. Please try again.' }, 502);
      }
    }

    // Not late → refund first if paid, then cancel
    if (paid?.providerPaymentId) {
      try {
        await refundPayment({
          providerPaymentId: paid.providerPaymentId,
          amount: paid.amount,
          reason: `Refund for cancellation: booking ${booking.id}`,
        });
        await prisma.payment.update({ 
          where: { id: paid.id }, 
          data: { status: 'REFUNDED' } 
        });
      } catch (refundError) {
        Sentry.captureException(refundError);
        return json({ error: 'Refund failed, try again later.' }, 502);
      }
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED', cancelReason },
      include: { service: true, business: true },
    });

    return json({ 
      message: paid ? 'Booking cancelled and refunded.' : 'Booking cancelled.', 
      booking: updated 
    });
  } catch (err) {
    Sentry.captureException(err);
    console.error('Cancel booking error:', err);
    return json({ error: 'Internal Server Error' }, 500);
  }
}