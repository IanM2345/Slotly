
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
    const user = await verifyToken(token);

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const businessId = params.id;

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        businessVerification: true,
        owner: true,
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    if (!business.businessVerification) {
      return NextResponse.json({ error: 'No verification submitted' }, { status: 400 });
    }

    await prisma.businessVerification.update({
      where: { businessId },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
      },
    });

    await createNotification({
      userId: business.ownerId,
      type: 'SYSTEM',
      title: 'Business Approved',
      message: `Your business "${business.name}" has been approved.`,
    });

    await sendNotification({
      userId: business.ownerId,
      type: 'SYSTEM',
      message: `Your business "${business.name}" has been approved.`,
    });

    await sendAdminEmailLog({
      subject: 'Business Approved',
      message: `Business "${business.name}" (${business.id}) was approved by Admin ${user.name} (${user.id}).`,
    });

    return NextResponse.json({ message: 'Business approved successfully' }, { status: 200 });
  } catch (error) {
    Sentry.captureException(error, {
      extra: { route: 'PATCH /business/verify', params }
    });
    console.error('[APPROVE_BUSINESS_ERROR]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
