import '@/sentry.server.config';
import * as Sentry from '@sentry/nextjs';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { authenticateRequest } from '@/middleware/auth';
import { sendNotification } from '@/lib/notifications/sendNotification';

const prisma = new PrismaClient();

export async function GET(request) {
  const auth = await authenticateRequest(request);
  if (!auth.valid || auth.decoded.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const referrals = await prisma.referral.findMany({
      include: {
        referrer: { select: { id: true, name: true, email: true } },
        referredUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(referrals);
  } catch (error) {
    Sentry.captureException(error, { tags: { section: 'ADMIN_GET_REFERRALS' } });
    console.error('Failed to fetch referrals:', error);
    return NextResponse.json({ error: 'Failed to fetch referrals' }, { status: 500 });
  }
}

export async function PATCH(request) {
  const auth = await authenticateRequest(request);
  if (!auth.valid || auth.decoded.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { referralId } = body;

    if (!referralId) {
      return NextResponse.json({ error: 'Missing referralId' }, { status: 400 });
    }

    const updated = await prisma.referral.update({
      where: { id: referralId },
      data: { rewardIssued: true },
    });

    const referral = await prisma.referral.findUnique({
      where: { id: referralId },
      include: {
        referrer: true,
        referredUser: true,
      },
    });

    if (referral?.referrer) {
      await sendNotification({
        userId: referral.referrer.id,
        title: 'Referral Reward Granted',
        message: `Thanks for referring ${referral.referredUser?.name || 'a user'}! Your reward has been issued.`,
        type: 'REFERRAL_REWARDED',
        metadata: { referralId },
      });
    }

    return NextResponse.json({ message: 'Referral marked as rewarded', updated });
  } catch (error) {
    Sentry.captureException(error, { tags: { section: 'ADMIN_PATCH_REFERRAL' } });
    console.error('Failed to reward referral:', error);
    return NextResponse.json({ error: 'Failed to reward referral' }, { status: 500 });
  }
}
