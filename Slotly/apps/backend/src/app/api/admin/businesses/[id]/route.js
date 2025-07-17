import '@/sentry.server.config';
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';

const prisma = new PrismaClient();

export async function GET(request, { params }) {
  const token = request.headers.get('authorization')?.split(' ')[1];
  const { valid, decoded } = await verifyToken(token);

  if (!valid || decoded.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const businessId = params.id;

  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        owner: { select: { id: true, name: true, email: true, phone: true } },
        businessVerification: true,
        subscription: true,
        adCampaigns: true,
        staff: { select: { id: true, name: true, email: true, suspended: true } },
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    return NextResponse.json({ business });
  } catch (error) {
    Sentry.captureException(error, {
      extra: { route: 'GET /admin/business/[id]', businessId }
    });
    console.error('Failed to fetch business:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const token = request.headers.get('authorization')?.split(' ')[1];
  const { valid, decoded } = await verifyToken(token);

  if (!valid || decoded.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const businessId = params.id;

  try {
    const business = await prisma.business.findUnique({ where: { id: businessId } });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    await prisma.business.update({
      where: { id: businessId },
      data: {
        name: `BANNED_${business.id}`,
        description: 'Business has been banned by admin',
        suspended: true,
        suspendedUntil: null,
      },
    });

    return NextResponse.json({ message: 'Business burned (soft-deleted) successfully' });
  } catch (error) {
    Sentry.captureException(error, {
      extra: { route: 'DELETE /admin/business/[id]', businessId }
    });
    console.error('Failed to burn business:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
