import '@/sentry.server.config'
import * as Sentry from '@sentry/nextjs'

import { NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { verifyToken } from '@/middleware/auth'
import { generateMonthlyReport } from '@/lib/reports' // To Be Implemented

const prisma = new PrismaClient()

export async function POST(request, { params }) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1]
    const admin = await verifyToken(token)

    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { businessId } = params

    if (!businessId) {
      Sentry.captureMessage('Missing businessId in report regeneration', { level: 'warning' })
      return NextResponse.json({ error: 'Missing businessId' }, { status: 400 })
    }

    // Check if business exists
    const business = await prisma.business.findUnique({ where: { id: businessId } })
    if (!business) {
      Sentry.captureMessage(`Tried to regenerate report for non-existent business: ${businessId}`, { level: 'warning' })
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const { period, fileUrl } = await generateMonthlyReport(businessId)

    const newReport = await prisma.monthlyReport.upsert({
      where: {
        businessId_period: {
          businessId,
          period,
        },
      },
      update: { fileUrl },
      create: {
        businessId,
        period,
        fileUrl,
      },
    })

    return NextResponse.json({ message: 'Report regenerated', report: newReport })
  } catch (error) {
    Sentry.captureException(error, { tags: { section: 'ADMIN_REGENERATE_REPORT' } })
    console.error('[ADMIN_REGENERATE_REPORT]', error)
    return NextResponse.json({ error: 'Failed to regenerate report' }, { status: 500 })
  }
}
