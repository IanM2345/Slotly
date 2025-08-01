
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';
import { createNotification } from '@/shared/notifications/createNotification';
import { sendNotification } from '@/shared/notifications/sendNotification';
import { sendAdminEmailLog } from '@/shared/notifications/sendAdminEmailLog';
import * as Sentry from '@sentry/nextjs';

const prisma = new PrismaClient();

export async function PATCH(req, { params }) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1];
    const admin = await verifyToken(token);

    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const businessId = params.id;
    const body = await req.json();
    const { reason, durationInDays } = body;

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        owner: true, 
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    if (business.suspended) {
      return NextResponse.json({ error: 'Business is already suspended' }, { status: 400 });
    }

    const suspendedUntil = new Date();
    suspendedUntil.setDate(suspendedUntil.getDate() + (durationInDays || 7));

    await prisma.business.update({
      where: { id: businessId },
      data: {
        suspended: true,
        suspendedUntil,
      },
    });

    await prisma.suspensionLog.create({
      data: {
        businessId,
        userId: business.ownerId,
        adminId: admin.id,
        reason: reason || null,
        action: 'BUSINESS_SUSPENSION',
        timestamp: new Date(),
      },
    });

    await createNotification({
      userId: business.ownerId,
      type: 'SYSTEM',
      title: 'Business Suspended',
      message: `Your business "${business.name}" has been suspended for ${durationInDays || 7} days.`,
    });

    await sendNotification({
      userId: business.ownerId,
      type: 'SYSTEM',
      message: `Your business "${business.name}" has been suspended.`,
    });

    await sendAdminEmailLog({
      subject: 'Business Suspension',
      message: `Business "${business.name}" (${business.id}) was suspended by Admin ${admin.name} (${admin.id}) for ${durationInDays || 7} days.\nReason: ${reason || 'No reason provided'}`,
    });

    return NextResponse.json({ message: 'Business suspended successfully' }, { status: 200 });
  } catch (error) {
    Sentry.captureException(error, {
      extra: { route: 'PATCH /business/suspend', params }
    });
    console.error('[BUSINESS_SUSPEND_ERROR]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
