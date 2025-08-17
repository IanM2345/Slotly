// app/api/manager/subscription/route.js
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';
import { createPaymentCheckout } from '@/lib/shared/intasend';

const prisma = new PrismaClient();

// Server-side pricing (KES). Keep this the single source of truth.
const PRICING = {
  LEVEL_1: 0,
  LEVEL_2: 999,
  LEVEL_3: 2999,
  LEVEL_4: 6999,
  LEVEL_5: 14999,
  LEVEL_6: 30000,
};

// Helpers
function monthFrom(date = new Date(), months = 1) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * GET /api/manager/subscription
 * Returns the current business's subscription (for the logged in BUSINESS_OWNER)
 */
export async function GET(request) {
  try {
    const { valid, decoded, error } = await verifyToken(request);
    if (!valid || decoded.role !== 'BUSINESS_OWNER') {
      return NextResponse.json({ error: error || 'Unauthorized' }, { status: 403 });
    }

    // Find the owner’s business
    const business = await prisma.business.findFirst({
      where: { ownerId: decoded.id },
    });
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { businessId: business.id },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    return NextResponse.json(subscription, { status: 200 });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/manager/subscription
 * Body: { plan?: 'LEVEL_1'|'LEVEL_2'|... }  // optional; defaults to business.plan or LEVEL_1
 * For paid plans: creates a Payment + IntaSend checkout.
 * For LEVEL_1 (free): activates/improves subscription immediately without checkout.
 */
export async function POST(request) {
  try {
    const { valid, decoded, error } = await verifyToken(request);
    if (!valid || decoded.role !== 'BUSINESS_OWNER') {
      return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 });
    }

    // Get the business for this owner
    const business = await prisma.business.findFirst({ where: { ownerId: decoded.id } });
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const requestedPlan = body?.plan || business.plan || 'LEVEL_1';

    // Price is computed on the server to avoid client tampering
    const amount = PRICING[requestedPlan];
    if (amount === undefined) {
      return NextResponse.json({ error: 'Invalid subscription plan' }, { status: 400 });
    }

    // Ensure a Subscription row exists (inactive if paid path)
    const existing = await prisma.subscription.findUnique({
      where: { businessId: business.id },
    });

    // FREE PLAN: activate immediately (no checkout, no payment row)
    if (amount === 0) {
      const start = new Date();
      // choose your own policy; here we set endDate to +1 month
      const end = monthFrom(start, 1);

      const sub = await prisma.subscription.upsert({
        where: { businessId: business.id },
        update: { plan: requestedPlan, startDate: start, endDate: end, isActive: true },
        create: {
          businessId: business.id,
          plan: requestedPlan,
          startDate: start,
          endDate: end,
          isActive: true,
        },
      });

      return NextResponse.json(
        {
          message: 'Free plan activated',
          subscriptionId: sub.id,
          active: true,
          checkoutUrl: null,
        },
        { status: 200 }
      );
    }

    // PAID PLAN: create Payment row + IntaSend checkout
    const txRef = `subscription-${business.id}-${Date.now()}`;

    const payment = await prisma.payment.create({
      data: {
        type: 'SUBSCRIPTION',
        businessId: business.id,
        amount: Number(amount), // your schema uses Int; PRICING is in KES whole units
        method: 'OTHER',        // will be finalized by webhook
        status: 'PENDING',
        fee: 0,
        provider: 'INTASEND',
        txRef,
      },
    });

    const checkout = await createPaymentCheckout({
      amount: Number(amount),
      currency: 'KES',
      // business may not have an email; IntaSend allows email optional
      email: null,
      name: business.name,
      phone: business?.mpesaPhoneNumber || undefined, // optional
      reference: txRef,
      redirect_url: `${process.env.PUBLIC_APP_URL}/subscription/success`,
      cancel_url: `${process.env.PUBLIC_APP_URL}/subscription/cancel`,
      metadata: { businessId: business.id, purpose: 'SUBSCRIPTION', plan: requestedPlan, paymentId: payment.id },
    });

    const checkoutUrl = checkout?.checkout_url || checkout?.url || null;
    const invoiceId = checkout?.invoice_id || checkout?.invoice || null;

    // save provider ids/links for traceability
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerPaymentId: invoiceId ?? undefined,
        checkoutLink: checkoutUrl ?? undefined,
      },
    });

    // make sure a subscription row exists; keep inactive until webhook success
    const sub = await prisma.subscription.upsert({
      where: { businessId: business.id },
      update: { plan: requestedPlan }, // don’t activate yet
      create: {
        businessId: business.id,
        plan: requestedPlan,
        startDate: new Date(),
        endDate: new Date(),
        isActive: false,
      },
    });

    return NextResponse.json(
      {
        checkoutUrl,
        reference: txRef,
        invoiceId,
        subscriptionId: sub.id,
        active: false,
      },
      { status: 200 }
    );
  } catch (err) {
    Sentry.captureException(err);
    console.error('manager/subscription error', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
