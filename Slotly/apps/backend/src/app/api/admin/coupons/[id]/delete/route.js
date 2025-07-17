import { NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { verifyToken } from '@/middleware/auth'
import { createNotification } from '@/shared/notifications/createNotification'
import { sendAdminEmailLog } from '@/shared/notifications/sendAdminEmailLog'

const prisma = new PrismaClient()

export async function DELETE(_, { params }) {
  try {
    const token = _.headers.get('authorization')?.split(' ')[1]
    const admin = await verifyToken(token)

    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const coupon = await prisma.coupon.findUnique({
      where: { id: params.id },
    })

    if (!coupon) {
      return NextResponse.json({ error: 'Coupon not found' }, { status: 404 })
    }

    await prisma.coupon.delete({
      where: { id: params.id },
    })

    const assignedUsers = await prisma.userCoupon.findMany({
      where: { couponId: params.id },
      select: { userId: true },
    })

    // Send notifications to all users assigned the coupon
    await Promise.all(
      assignedUsers.map(({ userId }) =>
        createNotification({
          userId,
          type: 'COUPON',
          title: 'Coupon Revoked',
          message: `The coupon "${coupon.code}" has been removed by an administrator.`,
        })
      )
    )

    await sendAdminEmailLog({
      subject: 'Coupon Deleted',
      message: `Admin ${admin.name || admin.id} deleted coupon "${coupon.code}" (ID: ${params.id})`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[ADMIN_DELETE_COUPON]', error)
    return NextResponse.json({ error: 'Failed to delete coupon' }, { status: 500 })
  }
}
