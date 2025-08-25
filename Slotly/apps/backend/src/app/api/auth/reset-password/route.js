import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import * as Sentry from '@sentry/nextjs';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function POST(req) {
  try {
    const { token, newPassword } = await req.json();

    if (!token || !newPassword || newPassword.length < 6) {
      return NextResponse.json({ message: 'Invalid payload' }, { status: 400 });
    }

    const reset = await prisma.passwordReset.findUnique({ where: { token } });
    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      return NextResponse.json({ message: 'Token invalid or expired' }, { status: 400 });
    }

    const hash = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction([
      prisma.user.update({ where: { id: reset.userId }, data: { password: hash } }),
      prisma.passwordReset.update({ where: { token }, data: { usedAt: new Date() } }),
      prisma.passwordReset.deleteMany({
        where: { userId: reset.userId, token: { not: token } }, // invalidate others
      }),
    ]);

    return NextResponse.json({ message: 'Password updated' });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ message: 'Failed to reset password' }, { status: 500 });
  }
}