import '@/sentry.server.config';
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const data = await request.json();
    const { bookingId, amount, method, status, fee } = data;

    if (!bookingId || amount == null || !method || !status || fee == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { business: true }
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const payment = await prisma.payment.create({
      data: {
        bookingId,
        amount: Number(amount),
        method,
        status,
        fee: Number(fee),
        businessId: booking.businessId
      }
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    Sentry.captureException?.(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get('bookingId');

    if (!bookingId) {
      return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 });
    }

    const payments = await prisma.payment.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(payments, { status: 200 });
  } catch (error) {
    Sentry.captureException?.(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
