import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';
import '@/sentry.server.config';
import * as Sentry from '@sentry/nextjs';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);

    if (!valid || !decoded || decoded.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = decoded.id;
    const now = new Date();

    const upcomingBookings = await prisma.booking.findMany({
      where: {
        userId,
        startTime: { gt: now },
      },
      include: {
        service: true,
        business: true,
        payment: true,
        reminder: true,
      },
      orderBy: { startTime: 'asc' },
    });

    const pastBookings = await prisma.booking.findMany({
      where: {
        userId,
        endTime: { lt: now },
      },
      include: {
        service: true,
        business: true,
        payment: true,
        reminder: true,
      },
      orderBy: { endTime: 'desc' },
    });

    return NextResponse.json({ upcomingBookings, pastBookings }, { status: 200 });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);

    if (!valid || !decoded || decoded.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = decoded.id;
    const body = await request.json();
    const {
      serviceId,
      businessId,
      startTime,
      endTime,
      status,
      couponCode,
    } = body;

    if (!serviceId || !businessId || !startTime || !endTime) {
      return NextResponse.json({ error: 'Missing required booking fields' }, { status: 400 });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      return NextResponse.json({ error: 'Invalid booking time range' }, { status: 400 });
    }

    let appliedCoupon = null;

    if (couponCode) {
      appliedCoupon = await prisma.userCoupon.findFirst({
        where: {
          userId,
          coupon: {
            code: couponCode,
            businessId,
            expiresAt: { gt: new Date() },
          },
          usedAt: null,
        },
        include: { coupon: true },
      });

      if (!appliedCoupon) {
        return NextResponse.json({ error: 'Invalid or already used coupon' }, { status: 400 });
      }
    }

    const newBooking = await prisma.booking.create({
      data: {
        userId,
        serviceId,
        businessId,
        startTime: start,
        endTime: end,
        status: status || 'PENDING',
        couponId: appliedCoupon?.couponId,
      },
      include: {
        service: true,
        business: true,
        payment: true,
        reminder: true,
        coupon: true,
      },
    });

    if (appliedCoupon) {
      await prisma.$transaction([
        prisma.userCoupon.update({
          where: { id: appliedCoupon.id },
          data: { usedAt: new Date() },
        }),
        prisma.coupon.update({
          where: { id: appliedCoupon.couponId },
          data: { timesUsed: { increment: 1 } },
        }),
      ]);
    }

    return NextResponse.json(newBooking, { status: 201 });
  } catch (error) {
    console.error('Error creating booking:', error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
