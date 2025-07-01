import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const userId = await verifyToken(token);
    const { valid, decoded } = await verifyToken(token);

    if (!valid || !decoded || decoded.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();

    const upcomingBookings = await prisma.booking.findMany({
      where: {
        userId: userId,
        startTime: { gt: now },
      },
      include: {
        service: true,
        business: true,
        payment: true,
        reminder: true,
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    const pastBookings = await prisma.booking.findMany({
      where: {
        userId: userId,
        endTime: { lt: now },
      },
      include: {
        service: true,
        business: true,
        payment: true,
        reminder: true,
      },
      orderBy: {
        endTime: 'desc',
      },
    });

    return NextResponse.json({ upcomingBookings, pastBookings }, { status: 200 });
  } catch (error) {
    console.error('Error fetching bookings:', error);
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
    const userId = await verifyToken(token);
    const { valid, decoded } = await verifyToken(token);

    if (!valid || !decoded || decoded.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { serviceId, businessId, startTime, endTime, status } = body;

    if (!serviceId || !businessId || !startTime || !endTime) {
      return NextResponse.json({ error: 'Missing required booking fields' }, { status: 400 });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      return NextResponse.json({ error: 'Invalid booking time range' }, { status: 400 });
    }

    const newBooking = await prisma.booking.create({
      data: {
        userId: userId,
        serviceId,
        businessId,
        startTime: start,
        endTime: end,
        status: status || 'PENDING',
      },
      include: {
        service: true,
        business: true,
        payment: true,
        reminder: true,
      },
    });

    return NextResponse.json(newBooking, { status: 201 });
  } catch (error) {
    console.error('Error creating booking:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
