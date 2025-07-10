import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';

const prisma = new PrismaClient();

async function getBusinessFromToken(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
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

  return { business };
}


export async function POST(request) {
  try {
    const { business, error, status } = await getBusinessFromToken(request);
    if (error) return NextResponse.json({ error }, { status });

    const { code, description, discount, isPercentage, expiresAt } = await request.json();

    if (!code || !discount || !expiresAt) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }


    const existing = await prisma.coupon.findFirst({
      where: { code, businessId: business.id },
    });

    if (existing) {
      return NextResponse.json({ error: 'Coupon code already exists' }, { status: 409 });
    }

    const newCoupon = await prisma.coupon.create({
      data: {
        code,
        description,
        discount,
        isPercentage: Boolean(isPercentage),
        expiresAt: new Date(expiresAt),
        businessId: business.id,
      },
    });

    return NextResponse.json(newCoupon, { status: 201 });
  } catch (err) {
    console.error('POST /manager/coupons error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}


export async function GET(request) {
  try {
    const { business, error, status } = await getBusinessFromToken(request);
    if (error) return NextResponse.json({ error }, { status });

    const { searchParams } = new URL(request.url);
    const active = searchParams.get('active');
    const expired = searchParams.get('expired');
    const used = searchParams.get('used');

    const now = new Date();

    const filters = {
      businessId: business.id,
    };

    
    if (active === 'true') {
      filters.expiresAt = { gt: now };
    } else if (expired === 'true') {
      filters.expiresAt = { lt: now };
    }

   
    if (used === 'true') {
      filters.userCoupons = { some: { usedAt: { not: null } } };
    } else if (used === 'false') {
      filters.userCoupons = { none: { usedAt: { not: null } } };
    }

    const coupons = await prisma.coupon.findMany({
      where: filters,
      orderBy: { createdAt: 'desc' },
      include: {
        userCoupons: true,
      },
    });

    const response = coupons.map(coupon => ({
      ...coupon,
      usageCount: coupon.userCoupons.filter(c => c.usedAt !== null).length,
      redeemedUsers: coupon.userCoupons.length,
    }));

    return NextResponse.json({ coupons: response }, { status: 200 });
  } catch (err) {
    console.error('GET /manager/coupons error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}


export async function DELETE(request) {
  try {
    const { business, error, status } = await getBusinessFromToken(request);
    if (error) return NextResponse.json({ error }, { status });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Coupon ID required' }, { status: 400 });
    }

    const coupon = await prisma.coupon.findFirst({
      where: {
        id,
        businessId: business.id,
      },
      include: {
        userCoupons: true,
      },
    });

    if (!coupon) {
      return NextResponse.json({ error: 'Coupon not found' }, { status: 404 });
    }

    if (coupon.userCoupons.some(c => c.usedAt !== null)) {
      return NextResponse.json({ error: 'Cannot delete a used coupon' }, { status: 400 });
    }

    await prisma.coupon.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Coupon deleted successfully' }, { status: 200 });
  } catch (err) {
    console.error('DELETE /manager/coupons error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
