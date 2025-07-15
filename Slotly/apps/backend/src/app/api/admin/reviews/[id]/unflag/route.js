
import { NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { verifyToken } from '@/middleware/auth'

const prisma = new PrismaClient()

export async function DELETE(req, { params }) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1]
    const admin = await verifyToken(token)

    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const reviewId = params.id

    await prisma.review.delete({
      where: { id: reviewId },
    })

    return NextResponse.json({ message: 'Review deleted' })
  } catch (error) {
    console.error('[ADMIN_DELETE_REVIEW]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}