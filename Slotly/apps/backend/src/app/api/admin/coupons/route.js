import '@/sentry.server.config'; 
import * as Sentry from '@sentry/nextjs';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';
import { createNotification } from '@/shared/notifications/createNotification';
import { sendNotification } from '@/shared/notifications/sendNotification';
import { sendAdminEmailLog } from '@/shared/notifications/sendAdminEmailLog';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const decoded = await verifyToken(token);
    if (!decoded || decoded.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const {
      code,
      description,
      discount,
      isPercentage,
      expiresAt,
      usageLimit,
      businessId,
      minimumSpend,
    } = body;

    if (!code || !discount || !expiresAt || !businessId) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    if (typeof discount !== 'number' || discount <= 0) {
      return NextResponse.json({ message: 'Discount must be a positive number' }, { status: 400 });
    }

    const existing = await prisma.coupon.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json({ message: 'Coupon code already exists' }, { status: 409 });
    }

    const coupon = await prisma.coupon.create({
      data: {
        code,
        description,
        discount,
        isPercentage,
        expiresAt: new Date(expiresAt),
        usageLimit: usageLimit || 1,
        minimumSpend,
        businessId,
        createdByAdmin: true,
      },
    });

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { managers: true },
    });

    if (business && business.managers && business.managers.length > 0) {
      const title = '🎟 New Coupon Created';
      const message = `Admin created a new coupon “${coupon.code}” for your business (${business.name}).`;

      for (const manager of business.managers) {
        const notif = await createNotification({
          userId: manager.id,
          type: 'COUPON_CREATED',
          title,
          message,
        });
        await sendNotification({ notification: notif, user: manager });
      }
    }

    await sendAdminEmailLog({
      subject: 'New Coupon Created',
      message: `Admin ${decoded.name || decoded.id} created coupon "${coupon.code}" for business ID ${businessId}.`,
    });

    return NextResponse.json({ message: 'Coupon created', coupon }, { status: 201 });
  } catch (error) {
    Sentry.captureException(error, { tags: { section: 'ADMIN_COUPON_CREATE' } });
    console.error('[ADMIN_COUPON_CREATE]', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
