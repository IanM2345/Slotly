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
  const body = await request.json();
  const { suspendedUntil, reason, unsuspend } = body;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { suspended: true, suspendedUntil: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (unsuspend === true) {
    if (!user.suspended) {
      return NextResponse.json({ message: 'User is not suspended' }, { status: 200 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        suspended: false,
        suspendedUntil: null,
      },
    });

    await prisma.suspensionLog.create({
      data: {
        userId,
        adminId: decoded.id,
        action: 'UNSUSPEND',
        reason: reason || 'No reason provided',
      },
    });

    return NextResponse.json({ message: 'User has been unsuspended' }, { status: 200 });
  }

  if (!suspendedUntil) {
    return NextResponse.json({ error: 'Missing suspendedUntil timestamp or unsuspend flag' }, { status: 400 });
  }

  const untilDate = new Date(suspendedUntil);

  if (isNaN(untilDate.getTime()) || untilDate.getTime() < Date.now()) {
    return NextResponse.json({ error: 'Suspension date must be a valid future timestamp' }, { status: 400 });
  }

 
  if (user.suspended && user.suspendedUntil?.toISOString() === untilDate.toISOString()) {
    return NextResponse.json({ message: 'User is already suspended until that date' }, { status: 200 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      suspended: true,
      suspendedUntil: untilDate,
    },
  });

  await prisma.suspensionLog.create({
    data: {
      userId,
      adminId: decoded.id,
      action: 'SUSPEND',
      reason: reason || 'No reason provided',
    },
  });

  return NextResponse.json({
    message: `User suspended until ${untilDate.toISOString()}`,
  }, { status: 200 });
}
