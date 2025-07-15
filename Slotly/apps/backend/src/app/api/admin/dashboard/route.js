import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { authenticaterequestuest } from '@/middleware/auth';

const prisma = new PrismaClient();

export async function GET(request) {
  const auth = await authenticaterequestuest(request);
  if (!auth.valid || auth.decoded.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [userCounts, businessCounts, bookingStats, revenueStats, subscriptionStats, reviewStats, referralStats] = await Promise.all([

      prisma.user.groupBy({
        by: ['role'],
        _count: { id: true },
      }),

      prisma.$transaction([
        prisma.business.count(),
        prisma.business.count({ where: { suspended: true } }),
        prisma.businessVerification.count({ where: { status: 'APPROVED' } }),
        prisma.businessVerification.count({ where: { status: 'PENDING' } }),
      ]),

      prisma.booking.groupBy({
        by: ['status'],
        _count: { id: true },
      }),

      prisma.payment.aggregate({
        _sum: { amount: true },
        _count: { id: true },
      }),

      prisma.subscription.groupBy({
        by: ['plan'],
        where: { isActive: true },
        _count: { id: true },
      }),

      prisma.$transaction([
        prisma.review.count(),
        prisma.review.count({ where: { flagged: true } }),
      ]),

      prisma.referral.aggregate({
        _count: { id: true },
        _sum: { rewardIssued: true },
      }),
    ]);

    const response = {
      usersByRole: Object.fromEntries(userCounts.map(u => [u.role, u._count.id])),
      businesses: {
        total: businessCounts[0],
        suspended: businessCounts[1],
        verified: businessCounts[2],
        pendingVerification: businessCounts[3],
      },
      bookingsByStatus: Object.fromEntries(bookingStats.map(b => [b.status, b._count.id])),
      revenue: {
        total: revenueStats._sum.amount || 0,
        transactions: revenueStats._count.id,
      },
      activeSubscriptions: Object.fromEntries(subscriptionStats.map(s => [s.plan, s._count.id])),
      reviews: {
        total: reviewStats[0],
        flagged: reviewStats[1],
      },
      referrals: {
        total: referralStats._count.id,
        rewardsIssued: referralStats._sum.rewardIssued || 0,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Dashboard metrics error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard metrics' }, { status: 500 });
  }
}