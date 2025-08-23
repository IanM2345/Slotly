// apps/backend/src/app/api/manager/me/route.js
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';

const prisma = new PrismaClient();

const DEFAULT_DAY = { open: true, start: '09:00', end: '20:00' };
const DEFAULT_HOURS = {
  monday: { ...DEFAULT_DAY },
  tuesday: { ...DEFAULT_DAY },
  wednesday: { ...DEFAULT_DAY },
  thursday: { ...DEFAULT_DAY },
  friday: { ...DEFAULT_DAY },
  saturday: { ...DEFAULT_DAY },
  sunday: { ...DEFAULT_DAY },
};

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);
    if (!valid || decoded.role !== 'BUSINESS_OWNER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    Sentry.setUser({ id: decoded.userId, role: decoded.role });

    const [business, owner] = await Promise.all([
      prisma.business.findFirst({ where: { ownerId: decoded.userId } }),
      prisma.user.findUnique({ where: { id: decoded.userId } }),
    ]);

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // include phone/email from owner, and default hours in the response
    const out = {
      ...business,
      hours: business?.hours ?? DEFAULT_HOURS,
      phone: owner?.phone ?? null,
      email: owner?.email ?? null,
    };

    return NextResponse.json(out, { status: 200 });
  } catch (error) {
    Sentry.captureException(error);
    console.error('GET /manager/me error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);
    if (!valid || decoded.role !== 'BUSINESS_OWNER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    Sentry.setUser({ id: decoded.userId, role: decoded.role });

    const payload = await request.json();
    const { logoUrl, name, description, address, latitude, longitude, hours, phone, email /*, type*/ } = payload || {};

    const existing = await prisma.business.findFirst({ where: { ownerId: decoded.userId } });
    if (!existing) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Update Business
    const updatedBusiness = await prisma.business.update({
      where: { id: existing.id },
      data: {
        ...(logoUrl !== undefined ? { logoUrl } : {}),
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(address !== undefined ? { address } : {}),
        ...(latitude !== undefined ? { latitude } : {}),
        ...(longitude !== undefined ? { longitude } : {}),
        ...(hours !== undefined ? { hours } : {}),
        // NOTE: to persist "type", add `type String?` to Business, then include it here.
      },
    });

    // Update owner User (phone/email)
    if (phone !== undefined || email !== undefined) {
      await prisma.user.update({
        where: { id: decoded.userId },
        data: {
          ...(phone !== undefined ? { phone } : {}),
          ...(email !== undefined ? { email } : {}),
        },
      });
    }

    // Return merged view (business + contact + default hours)
    const owner = await prisma.user.findUnique({ where: { id: decoded.userId } });
    const response = {
      ...updatedBusiness,
      hours: updatedBusiness.hours ?? DEFAULT_HOURS,
      phone: owner?.phone ?? null,
      email: owner?.email ?? null,
    };

    return NextResponse.json({ message: 'Business updated successfully', business: response }, { status: 200 });
  } catch (error) {
    Sentry.captureException(error);
    console.error('PUT /manager/me error:', error);
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
    if (!valid || decoded.role !== 'BUSINESS_OWNER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    Sentry.setUser({ id: decoded.userId, role: decoded.role });

    const business = await prisma.business.findFirst({ where: { ownerId: decoded.userId } });
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    await prisma.business.delete({ where: { id: business.id } });

    return NextResponse.json({ message: 'Business deleted successfully' }, { status: 200 });
  } catch (error) {
    Sentry.captureException(error);
    console.error('DELETE /manager/me error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}