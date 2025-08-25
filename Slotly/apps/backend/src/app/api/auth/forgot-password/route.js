import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import * as Sentry from '@sentry/nextjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

export async function POST(req) {
  try {
    const { email } = await req.json();

    // Always return 200 to avoid email enumeration
    const okResponse = NextResponse.json({ message: 'If that email exists, we sent a reset link.' });

    if (!email || typeof email !== 'string') return okResponse;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return okResponse;

    // create a token (random, single-use, 15 min expiry)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // optionally: delete old tokens for this user
    await prisma.passwordReset.deleteMany({ where: { userId: user.id } });

    await prisma.passwordReset.create({
      data: { userId: user.id, token, expiresAt },
    });

    // Build a reset URL (web/dev).
    // For mobile: you can email the token, or send a deep link (e.g., slotly://reset?token=...)
    const origin = process.env.APP_ORIGIN ?? process.env.NEXT_PUBLIC_APP_ORIGIN ?? '';
    const resetUrl = origin ? `${origin}/reset-password?token=${token}` : '';

    // TODO: send email here with resetUrl or the token
    // await mailer.send({ to: email, subject: 'Reset your password', text: `Reset: ${resetUrl}` })

    // In development, you can expose the token (remove in production):
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json({
        message: 'If that email exists, we sent a reset link.',
        devToken: token,
        devResetUrl: resetUrl,
      });
    }

    return okResponse;
  } catch (err) {
    Sentry.captureException(err);
    // Still return 200 to avoid email enumeration
    return NextResponse.json({ message: 'If that email exists, we sent a reset link.' });
  }
}