// app/api/business/register/route.js

import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';
import { createSubaccount } from '@/lib/shared/flutterwave';

const prisma = new PrismaClient();

/**
 * Minimal payout payload validator for your existing schema.
 * PayoutType in schema: MPESA_PHONE | MPESA_TILL | MPESA_PAYBILL | BANK
 */
const KENYAN_MSISDN = /^2547\d{8}$/; // e.g. 254712345678
const DIGITS_5_12 = /^\d{5,12}$/;

function onlyDigits(x) {
  return (x ?? '').toString().replace(/\D+/g, '');
}

function normalizeMsisdn(input) {
  if (!input) return input;
  return input
    .toString()
    .trim()
    .replace(/^\+/, '')   // +2547... -> 2547...
    .replace(/^0/, '254'); // 07... -> 2547...
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
    // All fields optional when payoutType is undefined/null
    return { ok: true, value: {} };
  }

  switch (payoutType) {
    case 'MPESA_PHONE': {
      const normalized = normalizeMsisdn(mpesaPhoneNumber);
      if (!normalized) return { ok: false, error: 'mpesaPhoneNumber is required' };
      if (!KENYAN_MSISDN.test(normalized)) {
        return { ok: false, error: 'mpesaPhoneNumber must look like 2547XXXXXXXX' };
      }
      return { ok: true, value: { mpesaPhoneNumber: normalized } };
    }

    case 'MPESA_TILL': {
      const till = onlyDigits(tillNumber);
      if (!till) return { ok: false, error: 'tillNumber is required' };
      if (!DIGITS_5_12.test(till)) return { ok: false, error: 'Invalid tillNumber' };
      return { ok: true, value: { tillNumber: till } };
    }

    case 'MPESA_PAYBILL': {
      const paybill = onlyDigits(paybillNumber);
      if (!paybill) return { ok: false, error: 'paybillNumber is required' };
      if (!DIGITS_5_12.test(paybill)) return { ok: false, error: 'Invalid paybillNumber' };
      // accountRef optional in your schema; keep if provided
      return { ok: true, value: { paybillNumber: paybill, accountRef: accountRef ?? null } };
    }

    case 'BANK': {
      const acct = onlyDigits(bankAccount);
      if (!bankName || !acct || !accountName) {
        return { ok: false, error: 'bankName, bankAccount and accountName are required' };
      }
      if (!DIGITS_5_12.test(acct)) return { ok: false, error: 'Invalid bankAccount' };
      return { ok: true, value: { bankName, bankAccount: acct, accountName } };
    }

    default:
      return { ok: false, error: 'Invalid payoutType' };
  }
}

const mask = (s) => (s ? s.toString().replace(/.(?=.{4})/g, '•') : s);

/**
 * POST /api/business/register
 */
export async function POST(request) {
  try {
    // Auth
    const { valid, decoded, error } = await verifyToken(request);
    if (!valid) return NextResponse.json({ error }, { status: 401 });
    const userId = decoded.id;

    // Payload
    const data = await request.json();
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
      idPhotoUrl,
      selfieWithIdUrl,
      contactInfo,

      // NEW payout routing fields
      payoutType,
      mpesaPhoneNumber,
      tillNumber,
      paybillNumber,
      accountRef,
      bankName,
      bankAccount,
      accountName,
    } = data;

    // Required business fields
    if (
      !name ||
      !address ||
      latitude === undefined ||
      longitude === undefined ||
      !idNumber ||
      !idPhotoUrl ||
      !type ||
      !contactInfo
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Business type checks
    if (type === 'FORMAL') {
      if (!regNumber || !licenseUrl || !selfieWithIdUrl) {
        return NextResponse.json({ error: 'Missing formal business fields' }, { status: 400 });
      }
    } else if (type === 'INFORMAL') {
      if (!selfieWithIdUrl) {
        return NextResponse.json({ error: 'Missing informal business fields' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'Invalid business type' }, { status: 400 });
    }

    // Validate + normalize payout fields (if provided)
    const validation = validatePayoutPayload({
      payoutType,
      mpesaPhoneNumber,
      tillNumber,
      paybillNumber,
      accountRef,
      bankName,
      bankAccount,
      accountName,
    });
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const normalized = validation.value || {};

    // Optional: create Flutterwave subaccount (legacy/optional)
    let flutterwaveSubaccountId = null;
    try {
      if (
        contactInfo?.account_number &&
        contactInfo?.account_bank &&
        contactInfo?.business_email
      ) {
        flutterwaveSubaccountId = await createSubaccount({
          name,
          account_bank: contactInfo.account_bank,
          account_number: contactInfo.account_number,
          business_email: contactInfo.business_email,
        });
      }
    } catch (subError) {
      Sentry.captureException(subError);
      console.warn(
        'Subaccount creation failed, but continuing:',
        subError?.response?.data || subError.message
      );
    }

    // Create Business
    const business = await prisma.business.create({
      data: {
        name,
        description: description ?? '',
        ownerId: userId,
        address,
        latitude: parseFloat(String(latitude)),
        longitude: parseFloat(String(longitude)),

        // Keep any legacy values you still store
        // (Note: your Business model no longer has flutterwaveSubaccountId,
        // but if you still keep it somewhere else, adapt here.)

        // Unified payout routing — matches your existing schema exactly
        payoutType: payoutType ?? null,
        mpesaPhoneNumber: normalized.mpesaPhoneNumber ?? null,
        tillNumber: normalized.tillNumber ?? null,
        paybillNumber: normalized.paybillNumber ?? null,
        accountRef: normalized.accountRef ?? null,
        bankName: normalized.bankName ?? null,
        bankAccount: normalized.bankAccount ?? null,
        accountName: normalized.accountName ?? null,

        // If you still keep bankCode/accountNumber elsewhere, map as needed.
        // (Your current Business model does not include bankCode/accountNumber fields.)
        logoUrl: null, // optional default; remove if you set elsewhere
      },
    });

    // Create BusinessVerification
    await prisma.businessVerification.create({
      data: {
        businessId: business.id,
        type,
        idNumber,
        licenseUrl: licenseUrl ?? null,
        regNumber: regNumber ?? null,
        idPhotoUrl,
        selfieWithIdUrl: selfieWithIdUrl ?? null,
        status: 'PENDING',
        createdAt: new Date(),
      },
    });

    // Promote user to BUSINESS_OWNER
    await prisma.user.update({
      where: { id: userId },
      data: { role: 'BUSINESS_OWNER' },
    });

    // Response (mask sensitive numbers)
    return NextResponse.json(
      {
        message: 'Business registration successful',
        business: {
          id: business.id,
          name: business.name,
          address: business.address,
          latitude: business.latitude,
          longitude: business.longitude,
          payoutType: business.payoutType ?? null,
          mpesaPhoneNumber: mask(business.mpesaPhoneNumber),
          tillNumber: mask(business.tillNumber),
          paybillNumber: mask(business.paybillNumber),
          accountRef: business.accountRef, // generally not sensitive
          bankName: business.bankName,
          bankAccount: mask(business.bankAccount),
          accountName: business.accountName,
          createdAt: business.createdAt,
          // If you persist flutterwaveSubaccountId elsewhere and want to expose it, add here.
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error?.code === 'P2002') {
      // Unique constraint (e.g., Business.name)
      return NextResponse.json(
        { error: 'A business with this name already exists.' },
        { status: 409 }
      );
    }
    Sentry.captureException(error);
    console.error('Error during business registration:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
