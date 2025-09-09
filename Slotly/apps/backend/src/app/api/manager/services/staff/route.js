import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth'; 

const prisma = new PrismaClient();

async function getBusinessFromToken(request) {
  try {
    // standardize to lowercase header everywhere
    const authHeader = request.headers.get('authorization');
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

    // Get all services for this business, including assigned staff
    const services = await prisma.service.findMany({
      where: { businessId: business.id },
      include: {
        serviceStaff: {
          include: { staff: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const assigned = [];
    const unassigned = [];
    for (const s of services) {
      const item = {
        serviceId: s.id,
        serviceName: s.name,
        staff: s.serviceStaff.map(a => ({ id: a.staff.id, name: a.staff.name })),
      };
      (item.staff.length > 0 ? assigned : unassigned).push(item);
    }

    return NextResponse.json({ assigned, unassigned }, { status: 200 });
  } catch (err) {
    Sentry.captureException(err);
    console.error(err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}