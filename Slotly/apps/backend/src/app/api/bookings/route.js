import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/lib/auth'; // 👈 add this

const prisma = new PrismaClient();


export async function POST(request) {
  const { valid, decoded, error } = verifyToken(request);
  if (!valid) return NextResponse.json({ error }, { status: 401 });

  if (decoded.role !== 'CUSTOMER') {
    return NextResponse.json({ error: 'Only customers can create bookings' }, { status: 403 });
  }

  try {
    const data = await request.json();
    const { businessId, serviceId, startTime } = data;

    if (!businessId || !serviceId || !startTime) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const service = await prisma.service.findUnique({ where: { id: serviceId }, select: { duration: true } });
    if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 });

    const start = new Date(startTime);
    const end = new Date(start.getTime() + service.duration * 60000);

    const booking = await prisma.booking.create({
      data: {
        userId: decoded.id, 
        businessId,
        serviceId,
        startTime: start,
        endTime: end,
      },
    });

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    console.error('Error creating booking:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request) {
  const { valid, decoded, error } = verifyToken(request);
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
    console.error('Error fetching bookings:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
