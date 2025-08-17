// src/jobs/subscriptions.js
import * as Sentry from '@sentry/nextjs';
import { PrismaClient } from '@/generated/prisma';
import { createPaymentCheckout } from '@/lib/shared/intasend';

const prisma = new PrismaClient();

// Server-side pricing (KES, whole units)
const PRICING = {
  LEVEL_1: 0,
  LEVEL_2: 999,
  LEVEL_3: 2999,
  LEVEL_4: 6999,
  LEVEL_5: 14999,
  LEVEL_6: 30000,
};

// Config
const GRACE_DAYS_BEFORE_SUSPEND = 2;  // suspend 2+ days after expiry
const BILLING_COOLDOWN_HOURS = 24;    // don't create more than one pending invoice per 24h

async function suspendBusiness(businessId, until = null) {
  await prisma.business.update({
    where: { id: businessId },
    data: {
      suspended: true,
      suspendedUntil: until,
    },
  });
}

/**
 * Finds active subscriptions that have expired and suspends the business
 * if it's been expired for >= GRACE_DAYS_BEFORE_SUSPEND.
 */
export async function runSubscriptionSuspensionMonitor() {
  try {
    const today = new Date();

    const overdueSubs = await prisma.subscription.findMany({
      where: {
        isActive: true,
        endDate: { lt: today },
      },
      include: { business: true },
    });

    let suspendedCount = 0;

    for (const sub of overdueSubs) {
      const daysExpired = Math.floor(
        (today.getTime() - sub.endDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysExpired >= GRACE_DAYS_BEFORE_SUSPEND && sub.business) {
        await suspendBusiness(sub.businessId, null);
        suspendedCount++;
      }
    }

    console.log(
      `✅ Suspension monitor: checked ${overdueSubs.length}, suspended ${suspendedCount}.`
    );
  } catch (err) {
    console.error('❌ Error in suspension monitor:', err);
    Sentry.captureException(err);
  } finally {
    try { await prisma.$disconnect(); } catch {}
  }
}

/**
 * For each overdue active subscription, create a PENDING SUBSCRIPTION payment
 * and an IntaSend checkout link (server-priced), unless one was created recently.
 */
export async function runSubscriptionBillingMonitor() {
  try {
    const today = new Date();

    const overdueSubs = await prisma.subscription.findMany({
      where: {
        isActive: true,
        endDate: { lt: today },
      },
      include: { business: true },
    });

    let createdCount = 0;

    for (const sub of overdueSubs) {
      const business = sub.business;
      if (!business) continue;

      const plan = business.plan || 'LEVEL_1';
      const amount = PRICING[plan];
      if (amount == null || amount <= 0) {
        // Free or unknown plan — skip billing
        continue;
      }

      // Idempotency: skip if a recent PENDING subscription payment exists
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - BILLING_COOLDOWN_HOURS);

      const existingPending = await prisma.payment.findFirst({
        where: {
          businessId: sub.businessId,
          type: 'SUBSCRIPTION',
          status: 'PENDING',
          provider: 'INTASEND',
          createdAt: { gt: cutoff },
        },
      });
      if (existingPending) continue;

      const txRef = `subscription-${sub.businessId}-${Date.now()}`;

      // Create PENDING payment
      const payment = await prisma.payment.create({
        data: {
          type: 'SUBSCRIPTION',
          businessId: sub.businessId,
          amount,          // Int in KES
          method: 'OTHER', // will be finalized by webhook
          status: 'PENDING',
          fee: 0,
          provider: 'INTASEND',
          txRef,
        },
      });

      // Create IntaSend checkout
      const checkout = await createPaymentCheckout({
        amount,
        currency: 'KES',
        email: null, // optionally fill with owner email
        name: business.name,
        phone: business?.mpesaPhoneNumber || undefined,
        reference: txRef,
        redirect_url: `${process.env.PUBLIC_APP_URL}/subscription/success`,
        cancel_url: `${process.env.PUBLIC_APP_URL}/subscription/cancel`,
        metadata: {
          businessId: sub.businessId,
          purpose: 'SUBSCRIPTION',
          paymentId: payment.id,
          plan,
        },
      });

      const checkoutUrl = checkout?.checkout_url || checkout?.url || null;
      const invoiceId = checkout?.invoice_id || checkout?.invoice || null;

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerPaymentId: invoiceId ?? undefined,
          checkoutLink: checkoutUrl ?? undefined,
        },
      });

      // TODO: send email/SMS/in-app notification to the business owner with checkoutUrl
      createdCount++;
    }

    console.log(
      `✅ Billing monitor: created ${createdCount} pending invoice(s) out of ${overdueSubs.length} overdue.`
    );
  } catch (err) {
    console.error('❌ Error in billing monitor:', err);
    Sentry.captureException(err);
  } finally {
    try { await prisma.$disconnect(); } catch {}
  }
}
