import '@/sentry.server.config';
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@generated/prisma';
import { verifyToken } from '@/middleware/auth';
import { createNotification } from '@/shared/notifications/createNotification'; 

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

    const requests = await prisma.timeOffRequest.findMany({
      where: { staffId: decoded.userId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ timeOffRequests: requests }, { status: 200 });
  } catch (error) {
    Sentry.captureException(error);
    console.error('GET /timeoff error:', error);
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

    const { startDate, endDate, reason } = await request.json();
    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
    }

    const staffOf = await prisma.business.findMany({
      where: { staff: { some: { id: decoded.userId } } }
    });

    const requests = await Promise.all(
      staffOf.map(async (business) => {
        const entry = await prisma.timeOffRequest.create({
          data: {
            staffId: decoded.userId,
            businessId: business.id,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            reason,
          }
        });
        
        await createNotification?.({
          userId: business.ownerId,
          type: 'TIME_OFF',
          title: 'New Staff Time Off Request',
          message: `A staff member requested time off (${startDate} to ${endDate}).`,
          metadata: { requestId: entry.id }
        });
        return entry;
      })
    );

    return NextResponse.json(requests.length === 1 ? requests[0] : requests, { status: 201 });
  } catch (error) {
    Sentry.captureException(error);
    console.error('POST /timeoff error:', error);
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
      return NextResponse.json({ error: 'Missing request ID' }, { status: 400 });
    }

    const deleted = await prisma.timeOffRequest.updateMany({
      where: {
        id,
        staffId: decoded.userId,
        status: 'PENDING',
      },
      data: { status: 'CANCELED' },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: 'Not found or already processed' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Request canceled' }, { status: 200 });
  } catch (error) {
    Sentry.captureException(error);
    console.error('DELETE /timeoff error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
