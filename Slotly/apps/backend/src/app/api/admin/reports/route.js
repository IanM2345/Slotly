
import * as Sentry from '@sentry/nextjs'

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

    const reports = await prisma.monthlyReport.findMany({
      include: {
        business: {
          select: { id: true, name: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ reports })
  } catch (error) {
    Sentry.captureException(error, { tags: { section: 'ADMIN_VIEW_REPORTS' } })
    console.error('[ADMIN_VIEW_REPORTS]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
