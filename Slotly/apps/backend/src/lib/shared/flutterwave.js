import axios from 'axios';
import { PrismaClient } from '@/generated/prisma';
import { twilioClient } from '@/shared/notifications/twilioClient';
import { sendEmailNotification } from '@/shared/notifications/sendEmailNotification';

const prisma = new PrismaClient();

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY;
const FLW_BASE_URL = 'https://api.flutterwave.com/v3';
const SLOTLY_RECEIVING_ACCOUNT = process.env.FLW_SLOTLY_ACCOUNT_ID;
const ADMIN_EMAIL = process.env.SLOTLY_ADMIN_EMAIL;

const headers = {
  Authorization: `Bearer ${FLW_SECRET_KEY}`,
  'Content-Type': 'application/json',
};

// Create a subaccount for a business
export const createSubaccount = async ({ name, account_bank, account_number, business_email }) => {
  const response = await axios.post(
    `${FLW_BASE_URL}/subaccounts`,
    {
      account_bank,
      account_number,
      business_name: name,
      business_email,
      split_type: 'percentage',
      split_value: 100,
    },
    { headers }
  );
  return response.data?.data?.id;
};

// Initiate a split payment using a subaccount
export const initiateSplitPayment = async ({ amount, customer, businessSubAccountId }) => {
  const response = await axios.post(
    `${FLW_BASE_URL}/payments`,
    {
      tx_ref: `booking-${Date.now()}`,
      amount,
      currency: 'KES',
      redirect_url: 'https://slotly.co.ke/payment-success',
      payment_options: 'card,mpesa',
      customer,
      subaccounts: [
        {
          id: businessSubAccountId,
          transaction_charge_type: 'percentage',
          transaction_charge: 100,
        },
      ],
      meta: {
        customerName: customer.name,
      },
    },
    { headers }
  );
  return response.data?.data?.link;
};

// Initiate fallback payout for cancellation fee
export const initiateCancellationFee = async ({ businessId, customer, amount }) => {
  const settings = await prisma.payoutSettings.findUnique({ where: { businessId } });

  if (!settings) throw new Error('Business payout settings not configured');

  return payoutFallback(settings.businessId, amount, customer);
};

const MAX_RETRIES = 3;
const RETRY_DELAY_BASE_MS = 1000; // Base delay: 1 second

export const payoutFallback = async (businessId, amount, customer) => {
  const settings = await prisma.payoutSettings.findUnique({ where: { businessId } });
  if (!settings) throw new Error('Missing payout settings');

  let attempt = 0;
  let lastError = null;

  while (attempt < MAX_RETRIES) {
    try {
      switch (settings.method) {
        case 'MPESA_PHONE':
          return await axios.post(
            `${FLW_BASE_URL}/transfers`,
            {
              account_bank: 'MPS',
              account_number: settings.mpesaPhone,
              amount,
              currency: 'KES',
              beneficiary_name: customer.name,
              reference: `slotly-cancel-${Date.now()}`,
              narration: 'Late cancellation fee',
            },
            { headers }
          );

        case 'FLW_SUBACCOUNT':
          return await initiateSplitPayment({
            amount,
            customer,
            businessSubAccountId: settings.flwSubaccountId,
          });

        case 'MPESA_TILL':
        case 'MPESA_PAYBILL':
          throw new Error('Till/Paybill payouts not supported directly. Use FLW subaccount fallback.');

        default:
          throw new Error(`Unsupported payout method: ${settings.method}`);
      }
    } catch (error) {
      lastError = error;
      const errorMsg = error?.response?.data?.message || error.message;
      console.warn(`⚠️ Payout attempt ${attempt + 1} failed: ${errorMsg}`);

      // Retry logic
      if (attempt < MAX_RETRIES - 1) {
        const delay = RETRY_DELAY_BASE_MS * 2 ** attempt;
        await new Promise((res) => setTimeout(res, delay));
        attempt++;
      } else {
        // Final failure notification
        await sendEmailNotification({
          to: ADMIN_EMAIL,
          subject: '❌ Slotly Payout Failed After Retries',
          body: `
Hi Admin,

A payout has failed **after ${MAX_RETRIES} attempts**.

🔢 Business ID: ${businessId}
💰 Amount: KES ${amount}
👤 Customer: ${customer.name} (${customer.email || 'N/A'})
📦 Method: ${settings.method}
⏱ Time: ${new Date().toISOString()}
❗ Final Error: ${errorMsg}

Please investigate this issue.
          `.trim(),
        });

        throw error; // Re-throw for upstream handlers (optional)
      }
    }
  }
};


// Create a payment link for a subscription
export const createSubscriptionPaymentLink = async (business, amount = 2000) => {
  const response = await axios.post(
    `${FLW_BASE_URL}/payments`,
    {
      tx_ref: `subscription-${business.id}-${Date.now()}`,
      amount,
      currency: 'KES',
      redirect_url: 'https://slotly.co.ke/subscription-success',
      payment_options: 'card,mpesa',
      customer: {
        email: business.email,
        name: business.name,
      },
      meta: {
        businessId: business.id,
      },
    },
    { headers }
  );
  return response.data?.data?.link;
};

// Verify Flutterwave webhook
export const verifyTransactionWebhook = async (req) => {
  const hash = req.headers.get('verif-hash');
  if (!hash || hash !== process.env.FLW_WEBHOOK_SECRET) {
    throw new Error('Invalid Flutterwave webhook signature');
  }

  const body = await req.json();
  return body;
};

// Verify a subaccount ID on Flutterwave
export const verifySubaccount = async (subaccountId) => {
  const res = await axios.get(`${FLW_BASE_URL}/subaccounts/${subaccountId}`, { headers });
  return res.data?.data;
};

// Suspend a business and notify staff
export const markBusinessAsSuspended = async (businessId) => {
  const business = await prisma.business.update({
    where: { id: businessId },
    data: { subscriptionStatus: 'suspended', suspended: true },
  });

  await prisma.staffEnrollment.updateMany({
    where: { businessId },
    data: { status: 'REJECTED', reviewedAt: new Date() },
  });

  const staff = await prisma.user.findMany({
    where: { id: { in: business.staffIds } },
    select: { phone: true },
  });

  for (const member of staff) {
    if (member.phone) {
      try {
        await twilioClient.messages.create({
          body: `Slotly Notice: Your business (${business.name}) has been suspended due to non-payment.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: member.phone,
        });
      } catch (err) {
        console.warn(`⚠️ Failed to send SMS to ${member.phone}:`, err.message);
      }
    }
  }

  await sendEmailNotification({
    to: business.email,
    subject: `[Slotly] Business Suspended`,
    body: `Hi ${business.name}, your business account has been suspended due to missed subscription payments.`,
  });
};
