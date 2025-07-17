import '@/sentry.server.config'; 
import * as Sentry from '@sentry/nextjs';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';
import { createNotification } from '@/shared/notifications/createNotification';
import { sendNotification } from '@/shared/notifications/sendNotification';
import { sendAdminEmailLog } from '@/shared/notifications/sendAdminEmailLog';

const prisma = new PrismaClient();

export async function POST(request, { params }) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    const admin = await verifyToken(token);
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { userId } = await request.json();

    const existing = await prisma.userCoupon.findUnique({
      where: {
        userId_couponId: {
          userId,
          couponId: params.id,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'User already has this coupon' }, { status: 409 });
    }

    const rewarded = await prisma.userCoupon.create({
      data: {
        userId,
        couponId: params.id,
      },
    });

    const [user, coupon] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.coupon.findUnique({ where: { id: params.id } }),
    ]);

    if (user && coupon) {
      const title = '🎁 You’ve received a new coupon!';
      const message = `You’ve been rewarded the coupon “${coupon.code}” by Slotly Admin. Use it before it expires.`;
     
      const notif = await createNotification({
        userId: user.id,
        type: 'COUPON_REWARD',
        title,
        message,
      });

      await sendNotification({ notification: notif, user });

      await sendAdminEmailLog({
        subject: 'Coupon Rewarded to User',
        message: `Admin ${admin.name || admin.id} rewarded coupon "${coupon.code}" (ID: ${coupon.id}) to user ${user.email || user.id}.`,
      });
    }

    return NextResponse.json({ success: true, reward: rewarded });
  } catch (error) {
    Sentry.captureException(error, { tags: { section: 'ADMIN_REWARD_COUPON' } });
    console.error('[ADMIN_REWARD_COUPON]', error);
    return NextResponse.json({ error: 'Failed to reward user' }, { status: 500 });
  }
}
