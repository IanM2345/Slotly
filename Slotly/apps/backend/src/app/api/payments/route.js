// app/api/payments/booking/route.js

import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';
import { createPaymentCheckout } from '@/lib/shared/intasend';

const prisma = new PrismaClient();

function mask(s) {
  return s ? String(s).replace(/.(?=.{4})/g, '•') : s;
}

/**
 * POST /api/payments/booking
 * Body: { bookingId: string }
 * Creates a PENDING Payment row and an IntaSend checkout, then returns the checkout URL.
 */
export async function POST(request) {
  try {
    // authenticate like the rest of your routes
    const { valid, decoded, error } = await verifyToken(request);
    if (!valid) return NextResponse.json({ error }, { status: 401 });

    const { bookingId } = await request.json();
    if (!bookingId) {
      return NextResponse.json({ error: 'bookingId required' }, { status: 400 });
    }

    // Load booking, service, and user (Mongo schema has no explicit relations, so fetch explicitly)
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    const [service, customer] = await Promise.all([
      prisma.service.findUnique({ where: { id: booking.serviceId } }),
      prisma.user.findUnique({ where: { id: booking.userId } }),
    ]);

    if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    const amount = Number(service.price ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid service price' }, { status: 400 });
    }

    // Unique reference for matching webhooks later (also stored in Payment.txRef)
    const txRef = `booking-${booking.id}-${Date.now()}`;

    // Create a pending Payment row
    const payment = await prisma.payment.create({
      data: {
        type: 'BOOKING',
        bookingId: booking.id,
        businessId: booking.businessId,
        amount,                // Int in KES cents? your schema uses Int; keep consistent with service.price
        method: 'OTHER',       // will finalize from webhook/status check
        status: 'PENDING',
        fee: 0,
        provider: 'INTASEND',
        txRef,
      },
    });

    // Prepare customer details for checkout (fallbacks are fine)
    const email = customer.email || 'noreply@slotly.local';
    const name = customer.name || 'Slotly User';
    const phone = customer.phone || undefined;

    // Create IntaSend checkout (card/M-Pesa)
    const checkout = await createPaymentCheckout({
      amount,
      currency: 'KES',
      email,
      name,
      phone,
      reference: txRef,
      redirect_url: `${process.env.PUBLIC_APP_URL}/payments/success`,
      cancel_url: `${process.env.PUBLIC_APP_URL}/payments/cancel`,
      metadata: {
        bookingId: booking.id,
        businessId: booking.businessId,
        purpose: 'BOOKING',
        paymentId: payment.id,
      },
    });

    const checkoutUrl = checkout?.checkout_url || checkout?.url || null;
    const invoiceId = checkout?.invoice_id || checkout?.invoice || null;

    // Persist provider ids / links for traceability
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerPaymentId: invoiceId ?? undefined,
        checkoutLink: checkoutUrl ?? undefined,
      },
    });

    return NextResponse.json(
      {
        link: checkoutUrl,
        paymentId: payment.id,
        txRef,
        invoiceId,
        customer: {
          name,
          email: mask(email),
          phone: phone ? mask(phone) : null,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    Sentry.captureException(error);
    console.error('Payment init error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/payments/booking?bookingId=...
 * Returns the list of Payment rows for a booking (latest first)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get('bookingId');
    if (!bookingId) {
      return NextResponse.json({ error: 'bookingId required' }, { status: 400 });
    }

    const payments = await prisma.payment.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(payments, { status: 200 });
  } catch (error) {
    Sentry.captureException?.(error);
    console.error('Payment list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
