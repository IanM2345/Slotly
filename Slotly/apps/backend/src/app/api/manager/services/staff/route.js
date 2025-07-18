
import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth'; 

const prisma = new PrismaClient();

async function getBusinessFromToken(request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { error: 'Unauthorized', status: 401 };
    }

    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token); 
    if (!valid || decoded.role !== 'BUSINESS_OWNER') {
      return { error: 'Unauthorized', status: 403 };
    }

    const business = await prisma.business.findFirst({
      where: { ownerId: decoded.userId },
    });

    if (!business) {
      return { error: 'Business not found', status: 404 };
    }

    Sentry.setUser({ id: decoded.userId, role: decoded.role });
    return { business };
  } catch (err) {
    Sentry.captureException(err);
    return { error: 'Token validation error', status: 500 };
  }
}

export async function GET(request) {
  try {
    const { business, error, status } = await getBusinessFromToken(request);
    if (error) return NextResponse.json({ error }, { status });

    const allStaff = await prisma.user.findMany({
      where: {
        staffOf: {
          some: {
            id: business.id,
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        servicesProvided: {
          where: {
            businessId: business.id,
          },
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const assigned = allStaff.filter((staff) => staff.servicesProvided.length > 0);
    const unassigned = allStaff.filter((staff) => staff.servicesProvided.length === 0);

    return NextResponse.json({ assigned, unassigned }, { status: 200 });
  } catch (err) {
    Sentry.captureException(err);
    console.error(err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
