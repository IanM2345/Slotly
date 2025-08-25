// apps/backend/src/app/api/users/change-password/route.js
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';
import * as Sentry from '@sentry/nextjs';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
// If needed: export const runtime = 'nodejs';

export async function POST(req) {
  try {
    const { userId } = await verifyToken(req); // must throw on invalid auth
    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ message: 'Both currentPassword and newPassword are required' }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ message: 'Password must be at least 6 characters' }, { status: 400 });
    }
    if (currentPassword === newPassword) {
      return NextResponse.json({ message: 'New password must be different' }, { status: 400 });
    }

    // Adjust field name if yours is different (commonly "passwordHash")
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }
    if (!user.passwordHash) {
      // Social login only (no local password)
      return NextResponse.json({ message: 'Password change not available for this account' }, { status: 400 });
    }

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ message: 'Incorrect current password' }, { status: 400 });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash },
    });

    // (Optional) Invalidate sessions / bump token version here
    return NextResponse.json({ message: 'Password updated' });
  } catch (err) {
    Sentry.captureException(err);
    if (err?.status === 401) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ message: 'Failed to update password' }, { status: 500 });
  }
}
