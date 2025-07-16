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

    const business = await prisma.business.findUnique({
      where: { id: businessId },
    })

    if (!business || !business.suspended) {
      return NextResponse.json({ error: 'Business is not suspended' }, { status: 400 })
    }

    await prisma.$transaction([
      prisma.business.update({
        where: { id: businessId },
        data: {
          suspended: false,
          suspendedUntil: null,
        },
      }),

      prisma.service.updateMany({
        where: { businessId },
        data: { available: true },
      }),

      prisma.suspensionLog.create({
        data: {
          businessId,
          userId: business.ownerId,
          adminId: admin.id,
          reason: 'Business unsuspended by admin',
          action: 'BUSINESS_UNSUSPENSION',
        },
      }),
    ])

    await createNotification({
      userId: business.ownerId,
      type: 'SYSTEM',
      title: 'Business Unsuspended',
      message: 'Your business has been unsuspended. You can now accept bookings again.',
    })

    await sendNotification({
      userId: business.ownerId,
      type: 'SYSTEM',
      message: 'Your business is now active again. Welcome back!',
    })

    await sendAdminEmailLog({
      subject: 'Business Unsuspended',
      message: `Admin ${admin.name || admin.id} has unsuspended the business "${business.name}" (ID: ${business.id}).`,
    })

    return NextResponse.json({ message: 'Business unsuspended successfully' }, { status: 200 })
  } catch (error) {
    console.error('[BUSINESS_UNSUSPEND_ERROR]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
