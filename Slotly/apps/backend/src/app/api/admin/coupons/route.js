
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const decoded = verifyToken(token);
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
      minimumSpend
    } = body;

    
    if (!code || !discount || !expiresAt || !businessId) {
      return NextResponse.json({ message: 'Missing requestuired fields' }, { status: 400 });
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
      }
    });

    return NextResponse.json({ message: 'Coupon created', coupon }, { status: 201 });
  } catch (error) {
    console.error('[ADMIN_COUPON_CREATE]', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}