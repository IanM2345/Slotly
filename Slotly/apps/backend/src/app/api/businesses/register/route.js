import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';
import { createSubaccount } from '@/lib/shared/flutterwave';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const { valid, decoded, error } = await verifyToken(request);
    if (!valid) return NextResponse.json({ error }, { status: 401 });

    const userId = decoded.id;
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
    } = data;

    if (
      !name || !address || latitude === undefined || longitude === undefined ||
      !idNumber || !idPhotoUrl || !type || !contactInfo
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

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

    
    let flutterwaveSubaccountId = null;
    try {
      if (contactInfo.account_number && contactInfo.account_bank && contactInfo.business_email) {
        flutterwaveSubaccountId = await createSubaccount({
          name,
          account_bank: contactInfo.account_bank,
          account_number: contactInfo.account_number,
          business_email: contactInfo.business_email,
        });
      }
    } catch (subError) {
      Sentry.captureException(subError);
      console.warn('Subaccount creation failed, but continuing:', subError?.response?.data || subError.message);
    }

  
    const business = await prisma.business.create({
      data: {
        name,
        description: description ?? '',
        ownerId: userId,
        address,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        flutterwaveSubaccountId: flutterwaveSubaccountId || undefined,
        bankCode: contactInfo.account_bank ?? undefined,
        accountNumber: contactInfo.account_number ?? undefined,
      },
    });

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

    await prisma.user.update({
      where: { id: userId },
      data: { role: 'BUSINESS_OWNER' },
    });

    return NextResponse.json({
      message: 'Business registration successful',
      business: {
        id: business.id,
        name: business.name,
        address: business.address,
        latitude: business.latitude,
        longitude: business.longitude,
        flutterwaveSubaccountId,
        createdAt: business.createdAt,
      },
    }, { status: 201 });

  } catch (error) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A business with this name already exists for this user.' },
        { status: 409 }
      );
    }

    Sentry.captureException(error);
    console.error('Error during business registration:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
