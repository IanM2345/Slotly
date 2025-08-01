import '@/sentry.server.config'
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);

    if (!valid || decoded.role !== 'BUSINESS_OWNER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

  
    Sentry.setUser({ id: decoded.userId, role: decoded.role });

    const business = await prisma.business.findFirst({
      where: { ownerId: decoded.userId },
      include: {
        subscription: true,
        businessVerification: true,
        staff: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        }
      }
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    return NextResponse.json(business, { status: 200 });
  } catch (error) {
    Sentry.captureException(error);
    console.error('GET /manager/me error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);

    if (!valid || decoded.role !== 'BUSINESS_OWNER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

   
    Sentry.setUser({ id: decoded.userId, role: decoded.role });

    const { logoUrl, name, description } = await request.json();

    const existingBusiness = await prisma.business.findFirst({
      where: { ownerId: decoded.userId }
    });

    if (!existingBusiness) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const updatedBusiness = await prisma.business.update({
      where: { id: existingBusiness.id },
      data: {
        logoUrl,
        name,
        description
      }
    });

    return NextResponse.json({ message: 'Business updated successfully', business: updatedBusiness }, { status: 200 });
  } catch (error) {
    Sentry.captureException(error);
    console.error('PUT /manager/me error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
