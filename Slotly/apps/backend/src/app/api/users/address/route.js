import { NextResponse } from 'next.server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';
import * as Sentry from '@sentry/nextjs';

const prisma = new PrismaClient();

// GET /api/users/address  -> returns {} if none
export async function GET(req) {
  try {
    const { userId } = await verifyToken(req); // must throw on invalid
    const address = await prisma.userAddress.findUnique({ where: { userId } });
    return NextResponse.json(address ?? {});
  } catch (err) {
    Sentry.captureException(err);
    // tweak these to match your verifyToken error types
    if (err?.name === 'AuthError' || err?.status === 401) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ message: 'Failed to fetch address' }, { status: 500 });
  }
}

// PUT /api/users/address  -> upsert
export async function PUT(req) {
  try {
    const { userId } = await verifyToken(req);
    const body = await req.json();

    const data = {
      county:       body.county ?? null,
      city:         body.city ?? null,
      constituency: body.constituency ?? null,
      street:       body.street ?? null,
      apartment:    body.apartment ?? null,
    };

    const saved = await prisma.userAddress.upsert({
      where:  { userId },
      create: { userId, ...data },
      update: data,
    });

    return NextResponse.json(saved);
  } catch (err) {
    Sentry.captureException(err);
    if (err?.name === 'AuthError' || err?.status === 401) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ message: 'Failed to save address' }, { status: 500 });
  }
}

