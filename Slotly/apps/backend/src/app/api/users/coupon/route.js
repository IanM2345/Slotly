import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';

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

    return NextResponse.json(
      { available, used, expired },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching user coupons:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
