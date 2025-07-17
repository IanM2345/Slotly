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

  const referrals = await prisma.referral.findMany({
    include: {
      referrer: { select: { id: true, name: true, email: true } },
      referredUser: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(referrals);
}

export async function PATCH(request) {
  const auth = await authenticateRequest(request);
  if (!auth.valid || auth.decoded.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
}
