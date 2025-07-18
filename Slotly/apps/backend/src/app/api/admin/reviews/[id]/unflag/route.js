
import * as Sentry from '@sentry/nextjs'

import { NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { verifyToken } from '@/middleware/auth'
import { createNotification } from '@/lib/createNotification' 

const prisma = new PrismaClient()

export async function PATCH(req, { params }) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1]
    const admin = await verifyToken(token)

    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const reviewId = params.id

    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        user: true,
        business: true,
      }
    })

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    const updated = await prisma.review.update({
      where: { id: reviewId },
      data: { flagged: false }
    })

    if (review.user) {
      await createNotification({
        userId: review.userId,
        type: 'REVIEW',
        title: 'Your review is visible again!',
        message: 'Your review was restored and is visible again.',
      })
    }

    if (review.business) {
      await createNotification({
        userId: review.business.ownerId,
        type: 'REVIEW',
        title: 'A review was restored',
        message: `A review on your business "${review.business.name}" was unflagged and is visible again.`,
      })
    }

    return NextResponse.json({ message: 'Review unflagged', review: updated })
  } catch (error) {
    Sentry.captureException(error, { tags: { route: 'ADMIN_UNFLAG_REVIEW' } })
    console.error('[ADMIN_UNFLAG_REVIEW]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
