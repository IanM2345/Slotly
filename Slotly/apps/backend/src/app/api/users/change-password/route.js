// apps/backend/src/app/api/users/change-password/route.js
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import * as Sentry from '@sentry/nextjs';
import bcrypt from 'bcryptjs';
import { requireAuth } from '@/lib/token';

const prisma = new PrismaClient();

export async function POST(req) {
  try {
    // Parse request body first to handle potential JSON parsing issues
    let body;
    try {
      const text = await req.text();
      if (!text || text.trim() === '') {
        return NextResponse.json(
          { message: 'Request body is required' },
          { status: 400 }
        );
      }
      body = JSON.parse(text);
    } catch (jsonError) {
      console.error('JSON parsing error:', jsonError.message);
      return NextResponse.json(
        { message: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Verify authentication - using the same pattern as /api/auth/me
    const { id: userId } = await requireAuth(req);
    const { currentPassword, newPassword } = body;

    // Validation
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { message: 'Both currentPassword and newPassword are required' },
        { status: 400 }
      );
    }
    if (newPassword.length < 6) {
      return NextResponse.json(
        { message: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }
    if (currentPassword === newPassword) {
      return NextResponse.json(
        { message: 'New password must be different' },
        { status: 400 }
      );
    }

    // Check if user exists and has a password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }
    if (!user.password) {
      return NextResponse.json(
        { message: 'Password change not available for this account' },
        { status: 400 }
      );
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { message: 'Incorrect current password' },
        { status: 400 }
      );
    }

    // Hash and update new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    // Optional: Revoke refresh tokens for security
    try {
      await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch (refreshTokenError) {
      // Don't fail the whole operation if refresh token cleanup fails
      console.warn('Failed to revoke refresh tokens:', refreshTokenError.message);
    }

    return NextResponse.json({ message: 'Password updated' }, { status: 200 });
    
  } catch (err) {
    console.error('Change password error:', err);
    Sentry.captureException(err);
    
    if (err?.status === 401) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { message: 'Failed to update password' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}