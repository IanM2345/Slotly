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
    const { reason } = body

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { businessVerification: true },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    if (!business.businessVerification) {
      return NextResponse.json({ error: 'No verification record found' }, { status: 400 })
    }

    if (business.businessVerification.status === 'REJECTED') {
      return NextResponse.json({ error: 'Business already rejected' }, { status: 400 })
    }

    
    await prisma.businessVerification.update({
      where: { businessId },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
      },
    })

    
    await prisma.business.update({
      where: { id: businessId },
      data: { suspended: true },
    })

    
    await prisma.suspensionLog.create({
      data: {
        businessId,
        userId: business.ownerId,
        adminId: admin.id,
        reason: reason || 'Verification rejected by admin',
        action: 'BUSINESS_REJECTION',
      },
    })

    return NextResponse.json({ message: 'Business rejected successfully' }, { status: 200 })
  } catch (error) {
    console.error('[BUSINESS_REJECT_ERROR]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}