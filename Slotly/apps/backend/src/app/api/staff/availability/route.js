import '@/sentry.server.config';
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@generated/prisma';
import { verifyToken } from '@/middleware/auth';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);
    if (!valid || decoded.role !== 'STAFF') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const slots = await prisma.availability.findMany({
      where: { staffId: decoded.userId },
      orderBy: { startTime: 'asc' }
    });

    return NextResponse.json({ availability: slots }, { status: 200 });
  } catch (error) {
    Sentry.captureException?.(error);
    console.error('GET availability error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);
    if (!valid || decoded.role !== 'STAFF') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { startTime, endTime } = await request.json();
    if (!startTime || !endTime) {
      return NextResponse.json({ error: 'startTime and endTime are required' }, { status: 400 });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    const overlappingTimeOff = await prisma.timeOffRequest.findFirst({
      where: {
        staffId: decoded.userId,
        status: 'APPROVED',
        startDate: { lte: end },
        endDate: { gte: start }
      }
    });

    if (overlappingTimeOff) {
      return NextResponse.json({
        error: 'This availability overlaps with an approved time-off request'
      }, { status: 400 });
    }

    const slot = await prisma.availability.create({
      data: {
        staffId: decoded.userId,
        startTime: start,
        endTime: end
      }
    });

    return NextResponse.json(slot, { status: 201 });
  } catch (error) {
    Sentry.captureException?.(error);
    console.error('POST availability error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);
    if (!valid || decoded.role !== 'STAFF') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing availability ID' }, { status: 400 });
    }

    const deleted = await prisma.availability.deleteMany({
      where: { id, staffId: decoded.userId }
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: 'Slot not found or not authorized' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Slot deleted' }, { status: 200 });
  } catch (error) {
    Sentry.captureException?.(error);
    console.error('DELETE availability error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
