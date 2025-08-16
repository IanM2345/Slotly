import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyTransactionWebhook } from '@/lib/shared/flutterwave';
import { PrismaClient } from '@/generated/prisma';

const prisma = globalThis.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;

// extend by plan; tweak to your rules
function extendEndDate(currentEndDate, plan) {
  const now = new Date();
  const from = currentEndDate && new Date(currentEndDate) > now ? new Date(currentEndDate) : now;
  const d = new Date(from);
  if (plan === 'PRO_YEARLY') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

export async function POST(request) {
  try {
    // 1) Verify + parse
    const event = await verifyTransactionWebhook(request);
    const kind = event?.event;
    const data = event?.data ?? {};
    const txRef = data?.tx_ref || data?.txRef || data?.reference || data?.txref || '';
    const status = data?.status;

    // 2) Ignore non-payment events
    if (kind !== 'charge.completed') {
      return NextResponse.json({ message: 'Ignored non-payment event' }, { status: 200 });
    }
    if (status !== 'successful') {
      console.warn(`❌ Transaction ${txRef} not successful`);
      return NextResponse.json({ message: 'Ignored unsuccessful transaction' }, { status: 200 });
    }

    // 3) Idempotency (one log per txRef)
    const existing = await prisma.webhookLog.findUnique({ where: { txRef } });
    if (existing) {
      return NextResponse.json({ message: 'Already processed' }, { status: 200 });
    }

    // Provider details
    const providerRef = data?.flw_ref || (data?.id ? String(data.id) : null);
    const appFee = Number(data?.app_fee ?? 0);
    const chargedAmount = Number(data?.charged_amount ?? data?.amount ?? 0);
    const currency = data?.currency || undefined;

    // 4) Booking payments (unchanged)
    if (txRef.startsWith('booking-')) {
      const bookingToken = txRef.replace('booking-', '');

      const updated = await prisma.payment.updateMany({
        where: { bookingId: bookingToken, status: 'PENDING' },
        data: { status: 'SUCCESS' },
      });

      // If you sometimes use paymentId in tx_ref, try direct id update as fallback
      if (updated.count === 0) {
        try {
          await prisma.payment.update({
            where: { id: bookingToken },
            data: { status: 'SUCCESS' },
          });
        } catch { /* not found -> ignore */ }
      }

      await prisma.webhookLog.create({ data: { txRef, type: 'BOOKING' } });
      return NextResponse.json(
        { message: `✅ Booking payment confirmed (${bookingToken})` },
        { status: 200 }
      );
    }

    // 5) Subscription payments (updated to use SubscriptionPayment)
    if (txRef.startsWith('subscription-')) {
      // Support two conventions:
      //   A) subscription-{subscriptionPaymentId}  (recommended)
      //   B) subscription-{businessId}             (legacy fallback)
      const token = txRef.replace('subscription-', '');

      let subPay = await prisma.subscriptionPayment.findUnique({ where: { id: token } });
      if (!subPay) {
        // fallback: treat token as businessId, pick most recent PENDING
        subPay = await prisma.subscriptionPayment.findFirst({
          where: { businessId: token, status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
        });
      }

      if (!subPay) {
        // Nothing to update, but log so we don't reprocess
        await prisma.webhookLog.create({ data: { txRef, type: 'SUBSCRIPTION' } });
        return NextResponse.json({ message: 'No matching SubscriptionPayment' }, { status: 200 });
      }

      // Update payment row (idempotent)
      if (subPay.status !== 'SUCCESS') {
        await prisma.subscriptionPayment.update({
          where: { id: subPay.id },
          data: {
            status: 'SUCCESS', // align with your enums/strings
            fee: Number.isFinite(appFee) ? Math.round(appFee) : subPay.fee ?? 0,
            reference: providerRef,
            // if your model has metadata/chargedAmount/currency fields, keep them; else remove
            metadata: {
              ...(subPay.metadata ?? {}),
              providerPayload: event,
              chargedAmount: Number.isFinite(chargedAmount) ? chargedAmount : undefined,
              currency,
            },
          },
        });
      }

      // Activate/extend the subscription itself
      const subscription = await prisma.subscription.findUnique({
        where: { id: subPay.subscriptionId },
      });
      if (subscription) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            isActive: true,
            startDate: subscription.startDate ?? new Date(),
            endDate: extendEndDate(subscription.endDate, subscription.plan),
          },
        });
      }

      await prisma.webhookLog.create({ data: { txRef, type: 'SUBSCRIPTION' } });
      return NextResponse.json(
        { message: `✅ Subscription payment processed (${subPay.id})` },
        { status: 200 }
      );
    }

    // 6) Unknown tx_ref shape → log & ack
    await prisma.webhookLog.create({ data: { txRef, type: 'UNKNOWN' } });
    return NextResponse.json({ message: 'Unhandled transaction reference' }, { status: 200 });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    Sentry.captureException(error);
    // Acknowledge to avoid retry storms; switch to 500 if you prefer retries
    return NextResponse.json({ error: 'Internal server error' }, { status: 200 });
  }
}
