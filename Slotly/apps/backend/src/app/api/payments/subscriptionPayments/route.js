import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { initiateSplitPayment } from '@/lib/shared/flutterwave';

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
      amount,                 // optional override
      currency = 'KES',
      returnUrl,
      cancelUrl,
      customer = {},
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
      include: {
        business: { include: { PayoutSettings: true } },
      },
    });

    if (!subscription?.business) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 404 });
    }

    const subaccountId = subscription.business.PayoutSettings?.flwSubaccountId;
    if (!subaccountId) {
      return NextResponse.json({ error: 'Payout settings not configured' }, { status: 500 });
    }

    // derive amount: client -> subscription.amount -> plan map
    const derivedAmount = Number.isFinite(amount) && amount > 0
      ? Number(amount)
      : Number(subscription.amount ?? PLAN_PRICES[subscription.plan] ?? 0);

    if (!Number.isFinite(derivedAmount) || derivedAmount <= 0) {
      return NextResponse.json({ error: 'Invalid subscription amount' }, { status: 400 });
    }

    const customerPayload = {
      email: subscription.business.email || customer.email || undefined,
      name: subscription.business.name || customer.name || undefined,
      phone_number: subscription.business.phone || customer.phone_number || undefined,
    };

    // create row (PENDING)
    const subPayment = await prisma.subscriptionPayment.create({
      data: {
        subscriptionId,
        businessId: subscription.business.id,
        amount: derivedAmount,
        currency,
        method: 'CARD_OR_MPESA',
        status: 'PENDING',
        fee: 0,
        returnUrl,
        cancelUrl,
        metadata: { ...metadata, plan: subscription.plan },
      },
    });

    // PSP checkout (Flutterwave split)
    const checkoutLink = await initiateSplitPayment({
      amount: derivedAmount,
      currency,
      customer: customerPayload,
      businessSubAccountId: subaccountId,
      reference: subPayment.id, // use DB id for webhook reconciliation
      returnUrl,
      cancelUrl,
      metadata: { subscriptionId, subscriptionPaymentId: subPayment.id, plan: subscription.plan },
    });

    await prisma.subscriptionPayment.update({
      where: { id: subPayment.id },
      data: { checkoutLink },
    });

    return NextResponse.json(
      { link: checkoutLink, subscriptionPaymentId: subPayment.id },
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
