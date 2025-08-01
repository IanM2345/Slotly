
import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken }  from '@/middleware/auth';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);

    if (!valid || decoded.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role'); 
    const suspended = searchParams.get('suspended'); 

    const filters = {};
    if (role) filters.role = role;
    if (suspended === 'true') filters.suspended = true;
    if (suspended === 'false') filters.suspended = false;

    const users = await prisma.user.findMany({
      where: filters,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        suspended: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ users }, { status: 200 });
  } catch (error) {
    Sentry.captureException(error, { tags: { route: 'ADMIN_USER_LIST' } });
    console.error('[ADMIN_USER_LIST]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
