

import { NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { verifyToken } from '@/middleware/auth'

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

    const untilDate = suspendedUntil ? new Date(suspendedUntil) : null

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
        },
      }),
    ])

    return NextResponse.json({ message: 'Business suspended successfully' }, { status: 200 })
  } catch (error) {
    console.error('[BUSINESS_SUSPEND_ERROR]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}