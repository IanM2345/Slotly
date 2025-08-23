
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/lib/auth';
import { sendNotification } from '@/lib/notifications/sendNotification';

const prisma = new PrismaClient();

export async function POST(request) {
  const { valid, decoded, error } = await verifyToken(request);
  if (!valid) return NextResponse.json({ error }, { status: 401 });

  if (decoded.role !== 'CUSTOMER') {
    return NextResponse.json({ error: 'Only customers can create bookings' }, { status: 403 });
  }

  try {
    const data = await request.json();
    const { businessId, serviceId, startTime, couponCode } = data;

    if (!businessId || !serviceId || !startTime) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const service = await prisma.service.findUnique({ where: { id: serviceId }, select: { duration: true, price: true } });
    if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 });

    const start = new Date(startTime);
    const end = new Date(start.getTime() + service.duration * 60000);

    let coupon = null;
    let discountApplied = 0;

    if (couponCode) {
      coupon = await prisma.coupon.findUnique({
        where: { code: couponCode },
        include: { business: true },
      });
      if (!coupon) return NextResponse.json({ error: 'Invalid coupon' }, { status: 404 });
      if (coupon.usedByUserId) return NextResponse.json({ error: 'Coupon already used' }, { status: 400 });

      discountApplied = coupon.isPercentage
        ? Math.floor(service.price * (coupon.discount / 100))
        : coupon.discount;
    }

    const booking = await prisma.booking.create({
      data: {
        userId: decoded.id,
        businessId,
        serviceId,
        startTime: start,
        endTime: end,
        couponId: coupon?.id || null,
        discountApplied,
      },
    });

    if (coupon) {
      await prisma.coupon.update({
        where: { id: coupon.id },
        data: {
          usedByUserId: decoded.id,
          usedAt: new Date(),
        },
      });

      await sendNotification({
        userId: decoded.id,
        title: 'Coupon Used',
        message: `You successfully used the coupon ${coupon.code}.`,
        type: 'COUPON_USED',
      });

      if (coupon.createdByAdmin) {
        const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
        for (const admin of admins) {
          await sendNotification({
            userId: admin.id,
            title: 'Coupon Redeemed',
            message: `Coupon ${coupon.code} was used by ${decoded.name || 'a user'}.`,
            type: 'COUPON_USED',
          });
        }
      } else if (coupon.business?.ownerId) {
        const businessOwner = await prisma.user.findUnique({
          where: { id: coupon.business.ownerId },
        });

        if (businessOwner) {
          await sendNotification({
            userId: businessOwner.id,
            title: 'Coupon Redeemed',
            message: `Coupon ${coupon.code} was used by ${decoded.name || 'a user'}.`,
            type: 'COUPON_USED',
          });
        }
      }
    }

    return NextResponse.json({ booking, discountApplied }, { status: 201 });
  } catch (error) {
    Sentry.captureException(error);
    console.error('[BOOKING_CREATE]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request) {
  const { valid, decoded, error } = await verifyToken(request);
  if (!valid) return NextResponse.json({ error }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const filters = {};

    if (decoded.role === 'CUSTOMER') {
      filters.userId = decoded.id;
    } else if (decoded.role === 'STAFF' || decoded.role === 'BUSINESS_OWNER') {
      const businessId = searchParams.get('businessId');
      if (businessId) filters.businessId = businessId;
    }

    const bookings = await prisma.booking.findMany({
      where: filters,
      orderBy: { startTime: 'asc' },
    });

    return NextResponse.json(bookings);
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error fetching bookings:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
