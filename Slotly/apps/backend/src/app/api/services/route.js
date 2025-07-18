import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();


export async function POST(request) {
  try {
    const data = await request.json();
    const { name, duration, price, businessId } = data;

    if (!name || !duration || !price || !businessId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (price <= 0 || duration <= 0) {
      return NextResponse.json({ error: 'Price and duration must be positive numbers' }, { status: 400 });
    }

    const service = await prisma.service.create({
      data: {
        name,
        duration,
        price,
        businessId,
      },
    });

    return NextResponse.json(service, { status: 201 });
  } catch (error) {
    Sentry.captureException?.(error);
    console.error('Error creating service:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    const services = await prisma.service.findMany({
      where: {
        businessId: businessId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        duration: true,
        price: true,
        createdAt: true,
      },
    });

    return NextResponse.json(services);
  } catch (error) {
    Sentry.captureException?.(error);
    console.error('Error fetching services:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
