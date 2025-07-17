import '@/sentry.server.config'
import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';
import { createNotification } from '@/shared/notifications/createNotification'; 

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

export async function DELETE(request) {
  try {
    const { business, error, status } = await getBusinessFromToken(request);
    if (error) return NextResponse.json({ error }, { status });

    const { serviceId, staffId } = await request.json();

    if (!serviceId || !staffId) {
      return NextResponse.json({ error: 'Missing serviceId or staffId' }, { status: 400 });
    }

    await prisma.service.update({
      where: { id: serviceId },
      data: {
        staff: {
          disconnect: { id: staffId },
        },
      },
    });

    const service = await prisma.service.findUnique({ where: { id: serviceId } });

    await createNotification({
      userId: staffId,
      type: 'STAFF_ASSIGNMENT',
      title: 'Unassigned from Service',
      message: `You have been unassigned from the service "${service?.name || 'a service'}".`,
      metadata: { serviceId, businessId: business.id },
    });

    return NextResponse.json({ message: 'Staff unassigned from service' }, { status: 200 });
  } catch (error) {
    Sentry.captureException(error);
    console.error('[STAFF_UNASSIGN_SERVICE]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
