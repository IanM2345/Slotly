
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { verifyToken } from '@/middleware/auth'
import { createNotification } from '@/shared/notifications/createNotification'
import { sendNotification } from '@/shared/notifications/sendNotification'
import { sendAdminEmailLog } from '@/shared/notifications/sendAdminEmailLog'

const prisma = new PrismaClient()

export async function PATCH(req, { params }) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1]
    const admin = await verifyToken(token)

    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const businessId = params.id
    const body = await req.json()
    const { reason, suspendedUntil } = body

    const business = await prisma.business.findUnique({
      where: { id: businessId },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    if (business.suspended) {
      return NextResponse.json({ error: 'Business is already suspended' }, { status: 400 })
    }

    const untilDate = suspendedUntil
      ? new Date(suspendedUntil)
      : new Date(new Date().setDate(new Date().getDate() + 30))

    await prisma.$transaction([
      prisma.business.update({
        where: { id: businessId },
        data: {
          suspended: true,
          suspendedUntil: untilDate,
        },
      }),

      prisma.service.updateMany({
        where: { businessId },
        data: { available: false },
      }),

      prisma.booking.updateMany({
        where: {
          businessId,
          startTime: { gte: new Date() },
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
        data: {
          status: 'CANCELLED',
        },
      }),

      prisma.suspensionLog.create({
        data: {
          businessId,
          userId: business.ownerId,
          adminId: admin.id,
          reason: reason || 'Suspended by admin',
          action: 'BUSINESS_SUSPENSION',
          timestamp: new Date(),
        },
      }),
    ])

    await createNotification({
      userId: business.ownerId,
      type: 'SYSTEM',
      title: 'Business Suspended',
      message: `Your business has been suspended${untilDate ? ` until ${untilDate.toDateString()}` : ''}. Reason: ${reason || 'No reason provided.'}`,
    })

    await sendNotification({
      userId: business.ownerId,
      type: 'SYSTEM',
      message: `Your business has been suspended. Please check admin panel for details.`,
    })

    await sendAdminEmailLog({
      subject: 'Business Suspended',
      message: `Admin ${admin.name} (${admin.id}) suspended business "${business.name}" (${businessId}) until ${untilDate.toISOString()}. Reason: ${reason || 'N/A'}`,
    })

    return NextResponse.json({ message: 'Business suspended successfully' }, { status: 200 })
  } catch (error) {
    Sentry.captureException(error, {
      extra: { route: 'PATCH /admin/business/suspend', params }
    })
    console.error('[BUSINESS_SUSPEND_ERROR]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
