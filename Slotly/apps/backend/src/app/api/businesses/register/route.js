// app/api/business/register/route.js

import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { authenticateRequest } from '@/middleware/auth';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Utility functions for validation
 */
const KENYAN_MSISDN = /^2547\d{8}$/;
const DIGITS_5_12 = /^\d{5,12}$/;

function onlyDigits(x) {
  return (x ?? '').toString().replace(/\D+/g, '');
}

function normalizeMsisdn(input) {
  if (!input) return input;
  return input
    .toString()
    .trim()
    .replace(/^\+/, '')
    .replace(/^0/, '254');
}

function validatePayoutPayload({
  payoutType,
  mpesaPhoneNumber,
  tillNumber,
  paybillNumber,
  accountRef,
  bankName,
  bankAccount,
  accountName,
}) {
  if (!payoutType) {
    return { ok: true, value: {} };
  }

  switch (payoutType) {
    case 'MPESA_PHONE': {
      const normalized = normalizeMsisdn(mpesaPhoneNumber);
      if (!normalized) return { ok: false, error: 'M-Pesa phone number is required' };
      if (!KENYAN_MSISDN.test(normalized)) {
        return { ok: false, error: 'M-Pesa phone number must be a valid Kenyan number (e.g., 0712345678)' };
      }
      return { ok: true, value: { mpesaPhoneNumber: normalized } };
    }

    case 'MPESA_TILL': {
      const till = onlyDigits(tillNumber);
      if (!till) return { ok: false, error: 'Till number is required' };
      if (!DIGITS_5_12.test(till)) return { ok: false, error: 'Till number must be 5-12 digits' };
      return { ok: true, value: { tillNumber: till } };
    }

    case 'MPESA_PAYBILL': {
      const paybill = onlyDigits(paybillNumber);
      if (!paybill) return { ok: false, error: 'Paybill number is required' };
      if (!DIGITS_5_12.test(paybill)) return { ok: false, error: 'Paybill number must be 5-12 digits' };
      return { ok: true, value: { paybillNumber: paybill, accountRef: accountRef ?? null } };
    }

    case 'BANK': {
      const acct = onlyDigits(bankAccount);
      if (!bankName || !acct || !accountName) {
        return { ok: false, error: 'Bank name, account number, and account name are all required for bank payouts' };
      }
      if (!DIGITS_5_12.test(acct)) return { ok: false, error: 'Bank account number must be 5-12 digits' };
      return { ok: true, value: { bankName, bankAccount: acct, accountName } };
    }

    default:
      return { ok: false, error: `Invalid payout type: ${payoutType}. Must be one of: MPESA_PHONE, MPESA_TILL, MPESA_PAYBILL, BANK` };
  }
}

function mask(s) {
  return s ? s.toString().replace(/.(?=.{4})/g, '•') : s;
}

/**
 * Validate required business fields
 */
function validateBusinessData(data, type) {
  const { name, address, latitude, longitude, idNumber, idPhotoUrl, contactInfo } = data;
  
  // Basic required fields
  const missing = [];
  if (!name?.trim()) missing.push('business name');
  if (!address?.trim()) missing.push('business address');
  if (latitude === undefined || latitude === null) missing.push('latitude');
  if (longitude === undefined || longitude === null) missing.push('longitude');
  if (!idNumber?.trim()) missing.push('ID number');
  if (!idPhotoUrl?.trim()) missing.push('ID photo');
  if (!contactInfo) missing.push('contact information');
  
  if (missing.length > 0) {
    return { ok: false, error: `Missing required fields: ${missing.join(', ')}` };
  }

  // Type-specific validation
  if (type === 'FORMAL') {
    const formalMissing = [];
    if (!data.regNumber?.trim()) formalMissing.push('registration number');
    if (!data.licenseUrl?.trim()) formalMissing.push('business license');
    if (!data.selfieWithIdUrl?.trim()) formalMissing.push('selfie with ID');
    
    if (formalMissing.length > 0) {
      return { ok: false, error: `Missing formal business fields: ${formalMissing.join(', ')}` };
    }
  } else if (type === 'INFORMAL') {
    if (!data.selfieWithIdUrl?.trim()) {
      return { ok: false, error: 'Selfie with ID is required for informal businesses' };
    }
  } else if (type) {
    return { ok: false, error: 'Business type must be either FORMAL or INFORMAL' };
  }

  return { ok: true };
}

/**
 * Check for and consume promo redemption - Updated version
 */
async function checkAndConsumePromoRedemption(userId, billing) {
  // If billing is already free, don't modify it
  if (!billing?.totalDue || Number(billing.totalDue) <= 0) {
    return {
      modifiedBilling: billing,
      modifiedPromoData: null,
      promoRedemption: null
    };
  }

  try {
    // Look for pending promo redemption for this user (using businessId: null as "not consumed" marker)
    const pendingRedemption = await prisma.promoRedemption.findFirst({
      where: { 
        userId, 
        code: "15208", 
        businessId: null  // ✅ This works now with nullable field
      },
      orderBy: { redeemedAt: "desc" },
    });
    
    if (pendingRedemption) {
      // Force billing to be free for trial period
      const modifiedBilling = {
        ...(billing || {}),
        planTier: (billing?.planTier || pendingRedemption.plan || "LEVEL1").toUpperCase(),
        currency: "KES",
        totalDue: 0,
        discountReason: "PROMO_TRIAL",
      };
      
      const modifiedPromoData = {
        promoCode: pendingRedemption.code,
        promoApplied: true,
        trialEndsOn: pendingRedemption.trialEnd.toISOString(),
      };

      return {
        modifiedBilling,
        modifiedPromoData,
        promoRedemption: pendingRedemption
      };
    }
  } catch (error) {
    console.warn("Promo redemption lookup failed (non-fatal):", error?.message || error);
  }

  return {
    modifiedBilling: billing,
    modifiedPromoData: null,
    promoRedemption: null
  };
}

/**
 * Create trial subscription and consume promo redemption - New improved version
 */
async function consumePromoAndCreateTrialSubscription(userId, businessId, promoRedemption, modifiedPromoData) {
  if (!promoRedemption || !modifiedPromoData) return null;

  try {
    // 1) Consume the promo by attaching it to the business
    await prisma.promoRedemption.update({
      where: { id: promoRedemption.id },
      data: { 
        businessId: businessId,
        consumedAt: new Date()
      },
    });

    // 2) Create a trial subscription aligned with the redemption window
    const subscription = await prisma.subscription.create({
      data: {
        userId,
        businessId,
        plan: (promoRedemption.plan || "LEVEL2").toUpperCase(),
        status: 'TRIAL',
        trialEndsAt: promoRedemption.trialEnd,
        currentPeriodStart: new Date(),
        currentPeriodEnd: promoRedemption.trialEnd,
        promo: promoRedemption.code,
        metadata: { origin: 'PROMO_TRIAL' },
      },
    });

    // 3) Record a zero-amount payment for the trial
    await prisma.payment.create({
      data: {
        userId,
        subscriptionId: subscription.id,
        amount: 0,
        currency: 'KES',
        status: 'COMPLETED',
        method: 'PROMO_TRIAL',
        reference: `TRIAL_${subscription.id}`,
        metadata: { 
          promoCode: promoRedemption.code,
          reason: 'Free trial via promo code'
        },
      },
    });

    return subscription;
  } catch (error) {
    console.error("Failed to consume promo and create trial:", error);
    throw error;
  }
}

/**
 * Handle regular subscription creation (non-promo)
 */
async function handleSubscription(userId, businessId, billing, promoData) {
  if (!billing || !billing.planTier || billing.planTier === 'LEVEL1') {
    // No subscription needed for basic tier
    return null;
  }

  const planTier = billing.planTier.toUpperCase();
  const totalDue = Number(billing.totalDue || 0);

  if (totalDue > 0) {
    // Create paid subscription (payment will be handled separately)
    const subscription = await prisma.subscription.create({
      data: {
        userId,
        businessId,
        plan: planTier,
        status: 'PENDING_PAYMENT',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        metadata: billing,
      },
    });

    return subscription;
  }

  return null;
}

/**
 * POST /api/business/register
 * Main business registration endpoint with improved promo code support
 */
export async function POST(request) {
  try {
    // Authenticate the request
    const auth = await authenticateRequest(request);
    if (!auth.valid) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const userId = auth.decoded.sub || auth.decoded.id;
    const data = await request.json();

    // Extract all request data
    const {
      name,
      description,
      address,
      latitude,
      longitude,
      type,
      idNumber,
      licenseUrl,
      regNumber,
      kraPin,
      idPhotoUrl,
      selfieWithIdUrl,
      contactInfo,
      payoutType,
      mpesaPhoneNumber,
      tillNumber,
      paybillNumber,
      accountRef,
      bankName,
      bankAccount,
      accountName,
      billing,
      attachments,
    } = data;

    // Validate business data
    const businessValidation = validateBusinessData(data, type);
    if (!businessValidation.ok) {
      return NextResponse.json({ error: businessValidation.error }, { status: 400 });
    }

    // Validate payout configuration
    const payoutValidation = validatePayoutPayload({
      payoutType,
      mpesaPhoneNumber,
      tillNumber,
      paybillNumber,
      accountRef,
      bankName,
      bankAccount,
      accountName,
    });
    if (!payoutValidation.ok) {
      return NextResponse.json({ error: payoutValidation.error }, { status: 400 });
    }
    const normalizedPayout = payoutValidation.value || {};

    // Check if user already has a business
    const existingBusiness = await prisma.business.findFirst({
      where: { ownerId: userId },
      select: { id: true, name: true }
    });

    if (existingBusiness) {
      return NextResponse.json(
        { error: 'You already have a registered business' },
        { status: 409 }
      );
    }

    // Handle Flutterwave subaccount creation (optional)
    let flutterwaveSubaccountId = null;
    try {
      if (
        contactInfo?.account_number &&
        contactInfo?.account_bank &&
        contactInfo?.business_email
      ) {
        // Implement createSubaccount function if needed
        // flutterwaveSubaccountId = await createSubaccount({
        //   name,
        //   account_bank: contactInfo.account_bank,
        //   account_number: contactInfo.account_number,
        //   business_email: contactInfo.business_email,
        // });
      }
    } catch (subError) {
      Sentry.captureException(subError);
      console.warn('Subaccount creation failed, continuing:', subError?.response?.data || subError.message);
    }

    // Check for promo redemption and modify billing accordingly
    const promoResult = await checkAndConsumePromoRedemption(userId, billing);
    const { modifiedBilling, modifiedPromoData, promoRedemption } = promoResult;

    // Create business and verification in a transaction
    const businessResult = await prisma.$transaction(async (tx) => {
      // Create the business record
      const business = await tx.business.create({
        data: {
          name: name.trim(),
          description: description?.trim() ?? '',
          ownerId: userId,
          address: address.trim(),
          latitude: parseFloat(String(latitude)),
          longitude: parseFloat(String(longitude)),
          
          // Payout routing fields
          payoutType: payoutType ?? null,
          mpesaPhoneNumber: normalizedPayout.mpesaPhoneNumber ?? null,
          tillNumber: normalizedPayout.tillNumber ?? null,
          paybillNumber: normalizedPayout.paybillNumber ?? null,
          accountRef: normalizedPayout.accountRef ?? null,
          bankName: normalizedPayout.bankName ?? null,
          bankAccount: normalizedPayout.bankAccount ?? null,
          accountName: normalizedPayout.accountName ?? null,
          
          logoUrl: null,
        },
        select: {
          id: true,
          name: true,
          address: true,
          latitude: true,
          longitude: true,
          payoutType: true,
          mpesaPhoneNumber: true,
          tillNumber: true,
          paybillNumber: true,
          accountRef: true,
          bankName: true,
          bankAccount: true,
          accountName: true,
          createdAt: true,
        }
      });

      // Create business verification record
      await tx.businessVerification.create({
        data: {
          businessId: business.id,
          type: type || 'INFORMAL',
          idNumber: idNumber.trim(),
          licenseUrl: licenseUrl?.trim() ?? null,
          regNumber: regNumber?.trim() ?? null,
          kraPin: kraPin?.trim() ?? null,
          idPhotoUrl: idPhotoUrl.trim(),
          selfieWithIdUrl: selfieWithIdUrl?.trim() ?? null,
          status: 'PENDING',
          attachments: attachments || [],
        },
      });

      return business;
    });

    // Handle subscription creation with improved promo logic
    let subscription = null;
    try {
      if (promoRedemption && modifiedPromoData) {
        // Handle promo trial subscription
        subscription = await consumePromoAndCreateTrialSubscription(
          userId, 
          businessResult.id, 
          promoRedemption, 
          modifiedPromoData
        );
      } else if (modifiedBilling && modifiedBilling.planTier !== 'LEVEL1') {
        // Handle regular subscription creation
        subscription = await handleSubscription(
          userId, 
          businessResult.id, 
          modifiedBilling, 
          modifiedPromoData
        );
      }
    } catch (subscriptionError) {
      Sentry.captureException(subscriptionError);
      console.warn('Subscription creation failed:', subscriptionError);
      // Continue - business registration was successful
    }

    // Update user role if needed and generate new token
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, name: true }
    });

    let updatedUser = currentUser;
    let newToken = null;

    if (currentUser.role !== 'BUSINESS_OWNER') {
      updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { role: 'BUSINESS_OWNER' },
        select: { id: true, email: true, role: true, name: true }
      });

      // Generate new JWT token with updated role
      if (JWT_SECRET) {
        newToken = jwt.sign(
          { 
            sub: updatedUser.id, 
            email: updatedUser.email, 
            role: updatedUser.role 
          },
          JWT_SECRET,
          { expiresIn: '30d' }
        );
      }
    }

    // Return comprehensive success response
    return NextResponse.json(
      {
        ok: true,
        message: 'Business registration successful',
        amountDue: modifiedBilling?.totalDue || 0,
        business: {
          id: businessResult.id,
          name: businessResult.name,
          address: businessResult.address,
          latitude: businessResult.latitude,
          longitude: businessResult.longitude,
          payoutType: businessResult.payoutType,
          mpesaPhoneNumber: mask(businessResult.mpesaPhoneNumber),
          tillNumber: mask(businessResult.tillNumber),
          paybillNumber: mask(businessResult.paybillNumber),
          accountRef: businessResult.accountRef,
          bankName: businessResult.bankName,
          bankAccount: mask(businessResult.bankAccount),
          accountName: businessResult.accountName,
          createdAt: businessResult.createdAt,
        },
        subscription: subscription ? {
          id: subscription.id,
          plan: subscription.plan,
          status: subscription.status,
          trialEndsAt: subscription.trialEndsAt,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
        } : null,
        user: updatedUser,
        token: newToken,
        promo: promoRedemption ? {
          code: promoRedemption.code,
          applied: true,
          trialStart: promoRedemption.redeemedAt.toISOString(),
          trialEnd: promoRedemption.trialEnd.toISOString(),
          consumed: true,
        } : null,
        billing: modifiedBilling,
      },
      { status: 201 }
    );

  } catch (error) {
    // Handle specific Prisma errors
    if (error?.code === 'P2002') {
      const target = error.meta?.target;
      if (target?.includes('name')) {
        return NextResponse.json(
          { error: 'A business with this name already exists' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'This business information conflicts with an existing record' },
        { status: 409 }
      );
    }

    // Log and report the error
    Sentry.captureException(error);
    console.error('Business registration error:', error);
    
    return NextResponse.json(
      { error: 'Internal server error. Please try again.' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}