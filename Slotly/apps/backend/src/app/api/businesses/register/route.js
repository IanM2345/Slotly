import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const { valid, decoded, error } = await verifyToken(request);
    if (!valid) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const userId = decoded.id;
    const data = await request.json();

    const {
      name,
      description,
      type,
      idNumber,
      licenseUrl,
      regNumber,
      idPhotoUrl,
      selfieWithIdUrl,
      contactInfo, 
    } = data;

    if (!name || !idNumber || !idPhotoUrl || !type || !contactInfo) {
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

    // Create Business
    const business = await prisma.business.create({
      data: {
        name,
        description: description ?? '',
        ownerId: userId,
      },
    });

    // Create Verification Record
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

    // Update user role
    await prisma.user.update({
      where: { id: userId },
      data: { role: 'BUSINESS_OWNER' },
    });

    return NextResponse.json({
          message: 'Business registration successful',
          business: {
            id: business.id,
            name: business.name,
            description: business.description,
            ownerId: business.ownerId,
            createdAt: business.createdAt
         }
    }, { status: 201 });


  } catch (error) {
    if (error.code === 'P2002') {
    return NextResponse.json(
      { error: 'A business with this name already exists for this user.' },
      { status: 409 }
    );
  }
    console.error('Error during business registration:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
