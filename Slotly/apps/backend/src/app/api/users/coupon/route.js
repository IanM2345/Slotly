import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';
import '@/sentry.server.config';
import * as Sentry from '@sentry/nextjs';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);
    if (!valid || !decoded?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = decoded.userId;
    const now = new Date();

    const userCoupons = await prisma.userCoupon.findMany({
      where: { userId },
      include: {
        coupon: true,
      },
    });

    const available = [];
    const used = [];
    const expired = [];

    for (const uc of userCoupons) {
      const { coupon, usedAt } = uc;

      if (usedAt) {
        used.push(coupon);
      } else if (coupon.expiresAt && new Date(coupon.expiresAt) < now) {
        expired.push(coupon);
      } else {
        available.push(coupon);
      }
    }

    const referrals = await prisma.referral.findMany({
      where: {
        referrerId: userId,
        rewardIssued: false,
        completedBookings: { gte: 2 },
      },
    });

    if (referrals.length >= 10) {
      const milestoneCode = `REF-BONUS-${userId}`;
      const alreadyRewarded = await prisma.userCoupon.findFirst({
        where: {
          userId,
          coupon: { code: milestoneCode },
        },
      });

      if (!alreadyRewarded) {
        const rewardCoupon = await prisma.coupon.create({
          data: {
            code: milestoneCode,
            description: 'Referral Milestone Bonus Coupon',
            discount: 20,
            isPercentage: true,
            usageLimit: 1,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            createdByAdmin: true,
          },
        });

        await prisma.userCoupon.create({
          data: {
            userId,
            couponId: rewardCoupon.id,
          },
        });

        const referralIds = referrals.map((r) => r.id);
        await prisma.referral.updateMany({
          where: { id: { in: referralIds } },
          data: { rewardIssued: true },
        });

        await prisma.notification.create({
          data: {
            userId,
            title: 'Referral Milestone Achieved!',
            message:
              'You’ve earned a bonus coupon for referring 10 users with 2+ bookings each!',
          },
        });

        const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
        for (const admin of admins) {
          await prisma.notification.create({
            data: {
              userId: admin.id,
              title: 'User Referral Reward Triggered',
              message: `User ${userId} has referred 10+ users who completed 2+ bookings.`,
            },
          });
        }

        available.push(rewardCoupon);
      }
    }

    return NextResponse.json({ available, used, expired }, { status: 200 });
  } catch (error) {
    console.error('Error fetching user coupons:', error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
