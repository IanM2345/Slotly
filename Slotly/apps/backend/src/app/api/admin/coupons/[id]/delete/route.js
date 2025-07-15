
import { NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { verifyToken } from '@/middleware/auth'

const prisma = new PrismaClient()

export async function DELETE(_, { params }) {
  try {
    const token = _.headers.get('authorization')?.split(' ')[1]
    const admin = await verifyToken(token)
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    await prisma.coupon.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[ADMIN_DELETE_COUPON]', err)
    return NextResponse.json({ error: 'Failed to delete coupon' }, { status: 500 })
  }
}