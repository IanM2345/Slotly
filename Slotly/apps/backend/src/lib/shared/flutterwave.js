import axios from 'axios';
import { PrismaClient } from '@/generated/prisma';
import { twilioClient } from '@/shared/notifications/twilioClient';
import { sendEmailNotification } from '@/shared/notifications/sendEmailNotification';

const prisma = new PrismaClient();

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY;
const FLW_BASE_URL = 'https://api.flutterwave.com/v3';
const SLOTLY_RECEIVING_ACCOUNT = process.env.FLW_SLOTLY_ACCOUNT_ID;

const headers = {
  Authorization: `Bearer ${FLW_SECRET_KEY}`,
  'Content-Type': 'application/json',
};


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
    },
    { headers }
  );
  return response.data?.data?.link; 
};


export const initiateCancellationFee = async ({ businessId, customer, amount }) => {
  const settings = await prisma.payoutSettings.findUnique({
    where: { businessId },
  });

  if (!settings) throw new Error('Business payout settings not configured');

  return payoutFallback(settings.businessId, amount, customer);
};


export const payoutFallback = async (businessId, amount, customer) => {
  const settings = await prisma.payoutSettings.findUnique({ where: { businessId } });
  if (!settings) throw new Error('Missing payout settings');

  switch (settings.method) {
    case 'MPESA_PHONE':
      return await axios.post(`${FLW_BASE_URL}/transfers`, {
        account_bank: 'MPS',
        account_number: settings.mpesaPhone,
        amount,
        currency: 'KES',
        beneficiary_name: customer.name,
        reference: `slotly-cancel-${Date.now()}`,
        narration: 'Late cancellation fee',
      }, { headers });

    case 'FLW_SUBACCOUNT':
      return await initiateSplitPayment({ amount, customer, businessSubAccountId: settings.flwSubaccountId });

    case 'MPESA_TILL':
    case 'MPESA_PAYBILL':
      throw new Error('Till/Paybill payouts not supported directly. Use FLW subaccount fallback.');

    default:
      throw new Error(`Unsupported payout method: ${settings.method}`);
  }
};


export const createSubscriptionPaymentLink = async (business, amount = 2000) => {
  const response = await axios.post(`${FLW_BASE_URL}/payments`, {
    tx_ref: `subscription-${business.id}-${Date.now()}`,
    amount,
    currency: 'KES',
    redirect_url: 'https://slotly.co.ke/subscription-success',
    payment_options: 'card,mpesa',
    customer: {
      email: business.email,
      name: business.name,
    },
    
  }, { headers });

  return response.data?.data?.link;
};


export const verifyTransactionWebhook = async (req) => {
  const hash = req.headers['verif-hash'];
  if (!hash || hash !== process.env.FLW_WEBHOOK_SECRET) {
    throw new Error('Invalid Flutterwave webhook signature');
  }

  const event = req.body;
  return event;
};


export const verifySubaccount = async (subaccountId) => {
  const res = await axios.get(`${FLW_BASE_URL}/subaccounts/${subaccountId}`, { headers });
  return res.data?.data;
};


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
      await twilioClient.messages.create({
        body: `Slotly Notice: Your business (${business.name}) has been suspended due to non-payment.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: member.phone,
      });
    }
  }

  await sendEmailNotification({
    to: business.email,
    subject: `[Slotly] Business Suspended`,
    body: `Hi ${business.name}, your business account has been suspended due to missed subscription payments.`,
  });
};
