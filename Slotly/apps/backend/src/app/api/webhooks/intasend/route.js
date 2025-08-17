// app/api/payments/intasend/webhook/route.js
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import {
  verifyIntaSendSignature,
  checkPaymentStatus,
  fetchPaymentByReference,
  createPayout,
} from '@/lib/shared/intasend';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    // 1) Verify signature
    const signatureOk = verifyIntaSendSignature(request);
    if (!signatureOk) return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });

    // 2) Parse event payload (tolerant to shape differences)
    const event = await request.json();
    const eventType =
      event?.event ||
      event?.type ||
      event?.data?.event ||
      event?.data?.type ||
      null;

    const txRef =
      event?.reference ||
      event?.data?.reference ||
      event?.metadata?.reference ||
      event?.meta?.reference ||
      null;

    const invoiceId =
      event?.invoice_id ||
      event?.invoice ||
      event?.data?.invoice_id ||
      event?.data?.invoice ||
      null;

    const rawStatus = (event?.status || event?.data?.status || '').toString().toLowerCase();

    // 3) Detect if this is a *refund* style event right up front
    //    Common signals: event type contains "refund" or "chargeback", or status is "refunded"
    const looksLikeRefund =
      /refund|chargeback/i.test(String(eventType || '')) ||
      rawStatus === 'refunded';

    // We need a stable unique key for idempotency logging.
    // Prefer txRef; if absent but we have invoiceId, synthesize one for refunds.
    const idempoKey = txRef || (looksLikeRefund && invoiceId ? `refund-${invoiceId}` : null);
    if (!idempoKey) {
      // Nothing we can safely act on; acknowledge to avoid retry storms
      return NextResponse.json({ message: 'No reference; ack' }, { status: 200 });
    }

    // 4) Idempotency guard via WebhookLog (unique txRef)
    try {
      await prisma.webhookLog.create({
        data: { txRef: idempoKey, type: 'INTASEND_PAYMENT', receivedAt: new Date() },
      });
    } catch {
      return NextResponse.json({ message: 'Duplicate webhook; ignored' }, { status: 200 });
    }

    // 5) Locate the local Payment row
    let payment = null;

    if (txRef) {
      payment = await prisma.payment.findFirst({ where: { txRef } });
    }

    // If this *looks like a refund* and we didn’t find by txRef, try invoiceId
    if (!payment && looksLikeRefund && invoiceId) {
      payment = await prisma.payment.findFirst({ where: { providerPaymentId: invoiceId } });
    }

    if (!payment) {
      // Not all events will map to a local row (e.g., unrelated); acknowledge
      return NextResponse.json({ message: 'No local Payment; ack' }, { status: 200 });
    }

    // ---------------------------
    // A) Handle explicit REFUND events (optional refinement #1)
    // ---------------------------
    if (looksLikeRefund) {
      // If already marked refunded, we’re done.
      if (payment.status === 'REFUNDED') {
        return NextResponse.json({ message: 'Already REFUNDED' }, { status: 200 });
      }

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'REFUNDED',
          // If the incoming event carries an invoice id, keep it synced
          providerPaymentId: invoiceId ?? payment.providerPaymentId ?? undefined,
        },
      });

      return NextResponse.json({ message: 'Marked REFUNDED' }, { status: 200 });
    }

    // ---------------------------
    // B) Normal payment success/failure flow
    // ---------------------------

    // If already terminal, stop here
    if (['SUCCESS', 'FAILED', 'REFUNDED'].includes(payment.status)) {
      return NextResponse.json({ message: 'Already processed' }, { status: 200 });
    }

    // Prefer verifying by invoice id; fallback to search by reference
    let verifyPayload = null;
    try {
      if (invoiceId || payment.providerPaymentId) {
        verifyPayload = await checkPaymentStatus({
          invoice_id: invoiceId || payment.providerPaymentId,
        });
      } else {
        verifyPayload = await fetchPaymentByReference(txRef);
      }
    } catch (vErr) {
      Sentry.captureException(vErr);
    }

    const v = verifyPayload || {};
    const vStatus =
      (v.status || v.payment_status || v?.data?.status || v?.data?.[0]?.status || rawStatus || '')
        .toString()
        .toLowerCase();

    const isSuccess = ['success', 'paid', 'completed'].includes(vStatus);

    // Optional refinement #2: zero-amount cancellation fees — treat as success
    const treatAsSuccess =
      isSuccess || (payment.type === 'CANCELLATION' && Number(payment.amount) === 0);

    const providerPaymentId =
      v.invoice_id || v.invoice || v.id || v?.data?.id || v?.data?.[0]?.id || invoiceId || null;

    const methodRaw =
      v.method || v.channel || v.payment_method || v?.data?.method || v?.data?.[0]?.method || 'OTHER';
    const method = String(methodRaw).toUpperCase();

    if (!treatAsSuccess) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', method, providerPaymentId },
      });
      return NextResponse.json({ message: 'Marked FAILED' }, { status: 200 });
    }

    // Mark SUCCESS first (to avoid double work if downstream fails)
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'SUCCESS', method, providerPaymentId },
    });

    // Post-success effects
    if (payment.type === 'BOOKING') {
      // Merchant payout
      const booking = await prisma.booking.findUnique({
        where: { id: payment.bookingId },
        include: { business: true },
      });
      const b = booking?.business;
      if (b) {
        try {
          const payoutRes = await createPayout({
            amount: payment.amount,
            currency: 'KES',
            reason: `Slotly booking ${booking.id}`,
            mpesaPhoneNumber: b.payoutType === 'MPESA_PHONE' ? b.mpesaPhoneNumber ?? undefined : undefined,
            tillNumber:      b.payoutType === 'MPESA_TILL'  ? b.tillNumber ?? undefined : undefined,
            paybillNumber:   b.payoutType === 'MPESA_PAYBILL' ? b.paybillNumber ?? undefined : undefined,
            accountRef:      b.payoutType === 'MPESA_PAYBILL' ? b.accountRef ?? undefined : undefined,
            bankName:        b.payoutType === 'BANK' ? b.bankName ?? undefined : undefined,
            bankAccount:     b.payoutType === 'BANK' ? b.bankAccount ?? undefined : undefined,
            accountName:     b.payoutType === 'BANK' ? b.accountName ?? undefined : undefined,
            reference: `payout-${booking.id}-${Date.now()}`,
            metadata: { businessId: b.id, bookingId: booking.id, paymentId: payment.id },
          });
          const payoutId = payoutRes?.id || payoutRes?.payout_id || payoutRes?.tracking_id || null;
          if (payoutId) {
            await prisma.payment.update({
              where: { id: payment.id },
              data: { providerPayoutId: payoutId },
            });
          }
        } catch (pErr) {
          console.warn('Payout failed:', pErr?.response?.data || pErr.message);
          Sentry.captureException(pErr);
        }
      }
    } else if (payment.type === 'SUBSCRIPTION') {
      const sub = await prisma.subscription.findFirst({ where: { businessId: payment.businessId } });
      const base = sub?.endDate && sub.endDate > new Date() ? sub.endDate : new Date();
      const nextEnd = new Date(base);
      nextEnd.setMonth(nextEnd.getMonth() + 1);
      await prisma.subscription.updateMany({
        where: { businessId: payment.businessId },
        data: { startDate: new Date(), endDate: nextEnd, isActive: true },
      });
    } else if (payment.type === 'CANCELLATION') {
      // Successful (or zero-amount) fee → cancel the booking
      if (payment.bookingId) {
        await prisma.booking.update({
          where: { id: payment.bookingId },
          data: { status: 'CANCELLED' },
        });
      }
    }

    return NextResponse.json({ message: 'OK' }, { status: 200 });
  } catch (err) {
    console.error('IntaSend webhook error:', err);
    Sentry.captureException(err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
