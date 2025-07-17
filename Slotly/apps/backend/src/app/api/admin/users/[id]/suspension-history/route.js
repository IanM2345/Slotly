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

    const logs = await prisma.suspensionLog.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      select: {
        id: true,
        action: true,
        reason: true,
        timestamp: true,
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ history: logs }, { status: 200 });
  } catch (error) {
    Sentry.captureException(error, { tags: { route: 'ADMIN_SUSPENSION_HISTORY' } });
    console.error('[ADMIN_SUSPENSION_HISTORY]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
