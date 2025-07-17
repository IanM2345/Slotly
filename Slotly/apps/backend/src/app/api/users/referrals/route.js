import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);
    if (!valid || !decoded?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = decoded.userId;

    const referrals = await prisma.referral.findMany({
      where: { referrerId: userId },
      include: {
        referredUser: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
            bookings: {
              where: { status: 'COMPLETED' },
              select: { id: true }
            }
          }
        }
      }
    });

    const validReferrals = referrals.filter(r => r.referredUser.bookings.length >= 2);
    const milestoneMet = validReferrals.length >= 10;
    const alreadyRewarded = validReferrals.every(r => r.rewardIssued === true);

    if (milestoneMet && !alreadyRewarded) {

      const couponCode = `REF-${Date.now()}`;
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); 

      const coupon = await prisma.coupon.create({
        data: {
          code: couponCode,
          description: 'KES 200 Referral Reward',
          discount: 200,
          isPercentage: false,
          expiresAt,
          createdByAdmin: false,
          usageLimit: 1,
          timesUsed: 0,
          businessId: '', 
        }
      });

      await prisma.userCoupon.create({
        data: {
          userId,
          couponId: coupon.id
        }
      });

      await prisma.notification.create({
        data: {
          userId,
          type: 'REFERRAL',
          title: '🎉 Referral Reward Unlocked!',
          message: `You referred 10 users who completed 2+ bookings. You've earned a KES 200 coupon: ${couponCode}`,
        }
      });

      const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
      const adminNotifications = admins.map(admin => ({
        userId: admin.id,
        type: 'REFERRAL',
        title: 'User Hit Referral Milestone',
        message: `User ${decoded.email} referred 10 users (2+ bookings each). Coupon issued.`,
      }));

      if (adminNotifications.length > 0) {
        await prisma.notification.createMany({ data: adminNotifications });
      }

      await prisma.referral.updateMany({
        where: {
          id: { in: validReferrals.map(r => r.id) }
        },
        data: { rewardIssued: true }
      });
    }

    const response = referrals.map(r => ({
      id: r.id,
      referredUserId: r.referredUser.id,
      name: r.referredUser.name,
      email: r.referredUser.email,
      joinedAt: r.referredUser.createdAt,
      completedBookings: r.referredUser.bookings.length,
      rewardIssued: r.rewardIssued
    }));

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Referral milestone error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
