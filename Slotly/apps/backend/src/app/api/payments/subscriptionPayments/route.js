// apps/backend/src/app/api/payments/subscriptionPayments/route.js
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { createPaymentCheckout } from '@/lib/shared/intasend';

const prisma = new PrismaClient();

const PLAN_PRICES = {
  BASIC_MONTHLY: 1000,
  PRO_MONTHLY: 2500,
  PRO_YEARLY: 25000,
};

export async function POST(request) {
  try {
    const {
      subscriptionId,
      amount,                 // optional client override (ignored if invalid)
      currency = 'KES',
      returnUrl,
      cancelUrl,
      customer = {},          // { email?, name?, phone_number? }
      metadata = {},
    } = await request.json();

    if (!subscriptionId) {
      return NextResponse.json({ error: 'subscriptionId is required' }, { status: 400 });
    }
    if (!returnUrl || !cancelUrl) {
      return NextResponse.json({ error: 'returnUrl and cancelUrl are required' }, { status: 400 });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { business: true },
    });

    if (!subscription?.business) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 404 });
    }

    // Derive amount: prefer valid client amount, else subscription.amount, else plan map
    const derivedAmount = Number.isFinite(Number(amount)) && Number(amount) > 0
      ? Number(amount)
      : Number(subscription.amount ?? PLAN_PRICES[subscription.plan] ?? 0);

    if (!Number.isFinite(derivedAmount) || derivedAmount <= 0) {
      return NextResponse.json({ error: 'Invalid subscription amount' }, { status: 400 });
    }

    // Compose customer payload (Business doesn’t have email/phone in your schema → use provided fallback)
    const customerEmail = customer.email ?? null;
    const customerName = subscription.business.name || customer.name || 'Slotly Business';
    const customerPhone = customer.phone_number ?? undefined;

    // 1) Create a PENDING SubscriptionPayment row
    const subPayment = await prisma.subscriptionPayment.create({
      data: {
        subscriptionId,
        businessId: subscription.businessId,
        amount: derivedAmount,
        currency,
        method: 'OTHER',               // will be finalized by webhook
        status: 'PENDING',
        fee: 0,
        returnUrl,
        cancelUrl,
        metadata: { ...metadata, plan: subscription.plan },
        provider: 'INTASEND',
      },
    });

    // 2) Build a unique reference for reconciliation (also store to txRef)
    const txRef = `subscription-${subscription.businessId}-${subPayment.id}-${Date.now()}`;
    await prisma.subscriptionPayment.update({
      where: { id: subPayment.id },
      data: { txRef },
    });

    // 3) Create IntaSend checkout
    const checkout = await createPaymentCheckout({
      amount: derivedAmount,
      currency,
      email: customerEmail,         // can be null
      name: customerName,
      phone: customerPhone,         // optional
      reference: txRef,             // important: you’ll match this in the webhook
      redirect_url: returnUrl,
      cancel_url: cancelUrl,
      metadata: {
        subscriptionId,
        subscriptionPaymentId: subPayment.id,
        businessId: subscription.businessId,
        plan: subscription.plan,
      },
    });

    const checkoutUrl = checkout?.checkout_url || checkout?.url || null;
    const invoiceId = checkout?.invoice_id || checkout?.invoice || null;

    // 4) Persist provider ids/links for traceability
    await prisma.subscriptionPayment.update({
      where: { id: subPayment.id },
      data: {
        checkoutLink: checkoutUrl ?? undefined,
        providerPaymentId: invoiceId ?? undefined, // IntaSend invoice_id
      },
    });

    return NextResponse.json(
      { link: checkoutUrl, subscriptionPaymentId: subPayment.id, reference: txRef, invoiceId },
      { status: 200 }
    );
  } catch (error) {
    Sentry.captureException?.(error);
    console.error('SubscriptionPayment init error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const subscriptionId = searchParams.get('subscriptionId');
    if (!subscriptionId) {
      return NextResponse.json({ error: 'subscriptionId is required' }, { status: 400 });
    }

    const payments = await prisma.subscriptionPayment.findMany({
      where: { subscriptionId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(payments, { status: 200 });
  } catch (error) {
    Sentry.captureException?.(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
