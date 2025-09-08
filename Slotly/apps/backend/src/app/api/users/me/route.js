import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import * as Sentry from '@sentry/nextjs';
import { verifyToken } from '@/middleware/auth';

const prisma = globalThis._prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalThis._prisma = prisma;

function extractUserId(decoded) {
  return (
    decoded.userId ?? decoded.id ?? decoded.sub ?? decoded._id ??
    decoded.user_id ?? decoded.user?.id ?? decoded.user?.userId ?? null
  );
}

async function getAuthedUserId(request) {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const { valid, decoded } = await verifyToken(token);
  if (!valid || !decoded) return null;
  return extractUserId(decoded);
}

/** GET /api/users/me – returns current profile (preload-friendly) */
export async function GET(request) {
  try {
    const userId = await getAuthedUserId(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, phone: true, name: true, role: true,
        avatarUrl: true, createdAt: true, updatedAt: true,
      },
    });

    if (!me) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(me, { status: 200 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/** PATCH /api/users/me – update name/phone/avatar */
export async function PATCH(request) {
  try {
    const userId = await getAuthedUserId(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { name, phone, avatarUrl } = body;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name != null ? { name } : {}),
        ...(phone != null ? { phone } : {}),
        ...(avatarUrl != null ? { avatarUrl } : {}),
      },
      select: {
        id: true, email: true, phone: true, name: true, role: true,
        avatarUrl: true, createdAt: true, updatedAt: true,
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/** DELETE /api/users/me – hard delete + cascade-ish cleanup */
export async function DELETE(request) {
  try {
    const userId = await getAuthedUserId(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await prisma.$transaction(async (tx) => {
      await tx.booking.deleteMany({ where: { userId } });
      await tx.refreshToken.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.userCoupon.deleteMany({ where: { userId } });
      await tx.review.deleteMany({ where: { userId } });
      await tx.availability.deleteMany({ where: { staffId: userId } });
      await tx.timeOffRequest.deleteMany({ where: { staffId: userId } });
      await tx.staffEnrollment.deleteMany({ where: { userId } });
      await tx.referral.deleteMany({ where: { OR: [{ referrerId: userId }, { referredUserId: userId }] } });
      await tx.previewLog.deleteMany({ where: { userId } });
      await tx.downloadLog.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });

    return NextResponse.json({ message: 'Account deleted' }, { status: 200 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}