import { NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { verifyToken } from '@/middleware/auth'

const prisma = new PrismaClient()

export async function PATCH(req, { params }) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1]
    const user = await verifyToken(token)

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const businessId = params.id

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { businessVerification: true },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    if (!business.businessVerification) {
      return NextResponse.json({ error: 'No verification submitted' }, { status: 400 })
    }

    await prisma.businessVerification.update({
      where: { businessId },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
      },
    })

    return NextResponse.json({ message: 'Business approved successfully' }, { status: 200 })

  } catch (err) {
    console.error('[APPROVE_BUSINESS_ERROR]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}