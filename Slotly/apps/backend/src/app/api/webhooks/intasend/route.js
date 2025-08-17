import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import {
  verifyIntaSendSignature,
  checkPaymentStatus,
  createPayout,
  // listBankCodes, // if you want to map bankName → bankCode here
} from '@/lib/shared/intasend';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    // 1) Verify signature/challenge (best effort)
    const signatureOk = verifyIntaSendSignature(request);
    if (!signatureOk) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // 2) Parse payload
    const event = await request.json();

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
    const looksLikeRefund =
      /refund|chargeback/i.test(String(event?.event || event?.type || '')) ||
      rawStatus === 'refunded';

    // Idempotency key
    const idempoKey = txRef || (looksLikeRefund && invoiceId ? `refund-${invoiceId}` : null);
    if (!idempoKey) {
      return NextResponse.json({ message: 'No stable reference; ack' }, { status: 200 });
    }

    // 3) Idempotency via WebhookLog (txRef must be UNIQUE in your schema)
    try {
      await prisma.webhookLog.create({
        data: { txRef: idempoKey, type: 'INTASEND_PAYMENT', receivedAt: new Date() },
      });
    } catch {
      return NextResponse.json({ message: 'Duplicate webhook; ignored' }, { status: 200 });
    }

    // 4) Find local Payment
    let payment = null;
    if (txRef) {
      payment = await prisma.payment.findFirst({ where: { txRef } });
    }
    if (!payment && looksLikeRefund && invoiceId) {
      payment = await prisma.payment.findFirst({ where: { providerPaymentId: invoiceId } });
    }
    if (!payment) {
      return NextResponse.json({ message: 'No local Payment; ack' }, { status: 200 });
    }

    // 5) Refunds branch
    if (looksLikeRefund) {
      if (payment.status !== 'REFUNDED') {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'REFUNDED',
            providerPaymentId: invoiceId ?? payment.providerPaymentId ?? undefined,
          },
        });
      }
      return NextResponse.json({ message: 'Marked REFUNDED' }, { status: 200 });
    }

    // 6) Early exit if terminal
    if (['SUCCESS', 'FAILED', 'REFUNDED'].includes(payment.status)) {
      return NextResponse.json({ message: 'Already processed' }, { status: 200 });
    }

    // 7) Verify status by invoice id (fallback to raw status)
    let verifyPayload = null;
    try {
      const idToCheck = invoiceId || payment.providerPaymentId;
      verifyPayload = idToCheck ? await checkPaymentStatus({ invoice_id: idToCheck }) : { status: rawStatus };
    } catch (vErr) {
      Sentry.captureException(vErr);
    }

    const v = verifyPayload || {};
    const vStatus =
      (v.status || v.payment_status || v?.data?.status || v?.data?.[0]?.status || rawStatus || '')
        .toString()
        .toLowerCase();

    const isSuccess = ['success', 'paid', 'completed'].includes(vStatus);

    // Treat zero-amount cancellation as success even without PSP success
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

    // 8) Mark success
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'SUCCESS', method, providerPaymentId },
    });

    // 9) Post-success effects
    if (payment.type === 'BOOKING') {
      const booking = await prisma.booking.findUnique({
        where: { id: payment.bookingId },
        include: { business: true },
      });

      const b = booking?.business;
      if (b) {
        try {
          // If you only store bankName (no bankCode), skip BANK payouts safely:
          const bankCode =
            b.payoutType === 'BANK'
              ? (b.bankCode /* if you add it to schema */ || null)
              : null;

          const payoutRes = await createPayout({
            amount: payment.amount,
            currency: 'KES',
            reason: `Slotly booking ${booking.id}`,           // ← fixed backticks
            reference: `payout-${booking.id}-${Date.now()}`,  // ← fixed backticks
            mpesaPhoneNumber: b.payoutType === 'MPESA_PHONE' ? b.mpesaPhoneNumber ?? undefined : undefined,
            tillNumber:      b.payoutType === 'MPESA_TILL'  ? b.tillNumber ?? undefined : undefined,
            paybillNumber:   b.payoutType === 'MPESA_PAYBILL' ? b.paybillNumber ?? undefined : undefined,
            accountRef:      b.payoutType === 'MPESA_PAYBILL' ? b.accountRef ?? undefined : undefined,
            bankCode:        bankCode ?? undefined, // REQUIRED for BANK payouts
            bankAccount:     b.payoutType === 'BANK' ? b.bankAccount ?? undefined : undefined,
            accountName:     b.payoutType === 'BANK' ? b.accountName ?? undefined : undefined,
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
          // Intentionally do not fail the webhook; you can retry payout later.
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
    } else if (payment.type === 'CANCELLATION' && payment.bookingId) {
      await prisma.booking.update({
        where: { id: payment.bookingId },
        data: { status: 'CANCELLED' },
      });
    }

    return NextResponse.json({ message: 'OK' }, { status: 200 });
  } catch (err) {
    console.error('IntaSend webhook error:', err);
    Sentry.captureException(err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
