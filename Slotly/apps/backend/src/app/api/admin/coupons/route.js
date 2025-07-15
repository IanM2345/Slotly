

import { NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { verifyToken } from '@/middleware/auth'

const prisma = new PrismaClient()

export async function GET(request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1]
    const admin = await verifyToken(token)
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const onlyFlagged = searchParams.get('flagged') === 'true'

    const coupons = await prisma.coupon.findMany({
      where: onlyFlagged ? { description: { contains: 'FLAGGED', mode: 'insensitive' } } : {},
      include: {
        business: true,
        userCoupons: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ coupons })
  } catch (err) {
    console.error('[ADMIN_GET_COUPONS]', err)
    return NextResponse.json({ error: 'Failed to fetch coupons' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1]
    const admin = await verifyToken(token)
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { code, description, discount, isPercentage, expiresAt, businessId } = body

    const newCoupon = await prisma.coupon.create({
      data: {
        code,
        description,
        discount,
        isPercentage,
        expiresAt: new Date(expiresAt),
        businessId,
      },
    })

    return NextResponse.json({ coupon: newCoupon }, { status: 201 })
  } catch (err) {
    console.error('[ADMIN_CREATE_COUPON]', err)
    return NextResponse.json({ error: 'Failed to create coupon' }, { status: 500 })
  }
}