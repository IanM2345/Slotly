import * as Sentry from '@sentry/nextjs';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { authenticateRequest } from '@/middleware/auth';
import { createNotification } from '@/shared/notifications/createNotification';

const prisma = new PrismaClient();

export async function GET(req) {
  const auth = await authenticateRequest(req);
  if (!auth.valid || auth.decoded.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const flaggedReviews = await prisma.review.findMany({
    where: { flagged: true },
    include: {
      user: { select: { id: true, name: true, email: true } },
      business: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ flaggedReviews });
}

export async function PATCH(req) {
  const auth = await authenticateRequest(req);
  if (!auth.valid || auth.decoded.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { type, id, action } = body;

  if (!type || !id || !action) {
    return NextResponse.json({ error: 'Missing type, id, or action' }, { status: 400 });
  }

  try {
    switch (type) {
      case 'review':
        if (action === 'flag') {
          const review = await prisma.review.update({
            where: { id },
            data: { flagged: true },
            include: {
              business: true,
              user: true,
            },
          });

          const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
          for (const admin of admins) {
            await createNotification({
              userId: admin.id,
              type: 'REVIEW',
              title: 'Review flagged by manager',
              message: `A review was flagged for moderation on business "${review.business?.name || ''}". Review by ${review.user?.name || 'a user'}.`,
            });
          }

          return NextResponse.json({ message: `Review ${id} flagged and admins notified.` });
        }

        if (action === 'unflag') {
          const review = await prisma.review.update({
            where: { id },
            data: { flagged: false },
            include: {
              business: true,
              user: true,
            },
          });

          
          if (review.business?.ownerId) {
            await createNotification({
              userId: review.business.ownerId,
              type: 'REVIEW',
              title: 'Review Unflagged',
              message: `A previously flagged review on "${review.business.name}" has been unflagged.`,
            });
          }
          if (review.user?.id) {
            await createNotification({
              userId: review.user.id,
              type: 'REVIEW',
              title: 'Your review was unflagged',
              message: 'Your review was cleared by admin and is now visible again.',
            });
          }

          return NextResponse.json({ message: `Review ${id} unflagged and parties notified.` });
        }

        return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });

      default:
        return NextResponse.json({ error: 'Unsupported flag type' }, { status: 400 });
    }
  } catch (error) {
    Sentry.captureException(error, { tags: { section: 'ADMIN_FLAG_REVIEW' } });
    console.error('Flag/unflag failed:', error);
    return NextResponse.json({ error: 'Failed to flag/unflag item' }, { status: 500 });
  }
}
