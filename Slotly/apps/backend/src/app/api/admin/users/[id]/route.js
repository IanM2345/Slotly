import '@/sentry.server.config'
import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';

const prisma = new PrismaClient();

export async function GET(request, { params }) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);

    if (!valid || decoded.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const userId = params.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        suspended: true,
        suspendedUntil: true,
        burned: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    Sentry.captureException(error, { tags: { route: 'ADMIN_USER_GET' } });
    console.error('[ADMIN_USER_GET]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);

    if (!valid || decoded.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const userId = params.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        name: 'Deleted User',
        email: `burned+${userId}@slotly.app`,
        phone: null,
        password: '',
        burned: true,
        suspended: true,
        suspendedUntil: new Date('2099-12-31T23:59:59.999Z'),
      },
    });

    await prisma.suspensionLog.create({
      data: {
        userId: userId,
        adminId: decoded.id,
        action: 'BURNED',
        reason: 'User permanently removed by admin',
      },
    });

    return NextResponse.json({ message: 'User soft-deleted (burned)' }, { status: 200 });
  } catch (error) {
    Sentry.captureException(error, { tags: { route: 'ADMIN_USER_DELETE' } });
    console.error('[ADMIN_USER_DELETE]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
