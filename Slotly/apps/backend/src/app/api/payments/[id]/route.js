import '@/sentry.server.config'; 
import * as Sentry from '@sentry/nextjs'; 
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';

const prisma = new PrismaClient();

export async function GET(request, { params }) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });
    }
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { booking: true },
    });
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }
    return NextResponse.json(payment, { status: 200 });
  } catch (error) {
    Sentry.captureException(error); 
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const { amount, method, status, fee } = await request.json();
    if (!id || amount == null || !method || !status || fee == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (isNaN(Number(amount)) || isNaN(Number(fee))) {
      return NextResponse.json({ error: 'Amount and fee must be numeric' }, { status: 400 });
    }
    const updated = await prisma.payment.update({
      where: { id },
      data: {
        amount: Number(amount),
        method,
        status,
        fee: Number(fee),
      },
    });
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    Sentry.captureException(error); 
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });
    }

   
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);
    if (!valid || decoded.role !== 'STAFF') {
      return NextResponse.json({ error: 'Forbidden: Staff only' }, { status: 403 });
    }

    const payment = await prisma.payment.findUnique({
      where: { id },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    await prisma.payment.delete({ where: { id } });

    return NextResponse.json({ message: 'Payment deleted successfully' }, { status: 200 });
  } catch (error) {
    Sentry.captureException(error); 
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
