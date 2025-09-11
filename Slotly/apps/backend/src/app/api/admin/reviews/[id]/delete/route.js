
import * as Sentry from '@sentry/nextjs'

import { NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { verifyToken } from '@/middleware/auth'
import { createNotification } from '@/shared/notifications/createNotification' 

const prisma = new PrismaClient()

export async function DELETE(req, { params }) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1]
    const admin = await verifyToken(token)

    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const reviewId = params.id

    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: { user: true }
    })

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    await prisma.review.delete({
      where: { id: reviewId },
    })

    if (review.user) {
      await createNotification({
        userId: review.userId,
        type: 'REVIEW',
        title: 'Your review was deleted',
        message: 'Your review was removed by an administrator.',
      })
    }

    return NextResponse.json({ message: 'Review deleted' })
  } catch (error) {
    Sentry.captureException(error, { tags: { route: 'ADMIN_DELETE_REVIEW' } })
    console.error('[ADMIN_DELETE_REVIEW]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
