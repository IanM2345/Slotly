
import { NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { verifyToken } from '@/middleware/auth'

const prisma = new PrismaClient()

export async function POST(request, { params }) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1]
    const admin = await verifyToken(token)
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { userId } = await request.json()

    const existing = await prisma.userCoupon.findUnique({
      where: {
        userId_couponId: {
          userId,
          couponId: params.id,
        },
      },
    })

    if (existing) {
      return NextResponse.json({ error: 'User already has this coupon' }, { status: 409 })
    }

    const rewarded = await prisma.userCoupon.create({
      data: {
        userId,
        couponId: params.id,
      },
    })

    return NextResponse.json({ success: true, reward: rewarded })
  } catch (err) {
    console.error('[ADMIN_REWARD_COUPON]', err)
    return NextResponse.json({ error: 'Failed to reward user' }, { status: 500 })
  }
}