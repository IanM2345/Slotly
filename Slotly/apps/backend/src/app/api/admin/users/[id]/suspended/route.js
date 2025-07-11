
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';

const prisma = new PrismaClient();

export async function PATCH(request, { params }) {
  const token = request.headers.get('authorization')?.split(' ')[1];
  const { valid, decoded } = await verifyToken(token);

  if (!valid || decoded.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const userId = params.id;
  const { suspendedUntil } = await request.json(); // e.g. "2025-07-15T23:59:00Z"

  if (!suspendedUntil) {
    return NextResponse.json({ error: 'Missing suspendedUntil timestamp' }, { status: 400 });
  }

  const untilDate = new Date(suspendedUntil);
  if (isNaN(untilDate.getTime())) {
    return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      suspended: true,
      suspendedUntil: untilDate,
    },
  });

  return NextResponse.json({ message: `User suspended until ${untilDate.toISOString()}` }, { status: 200 });
}
