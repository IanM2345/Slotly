

import { NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { verifyToken } from '@/middleware/auth'
import { generateMonthlyReport } from '@/lib/reports' // To Be Implemnetd

const prisma = new PrismaClient()

export async function POST(request, { params }) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1]
    const admin = await verifyToken(token)

    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { businessId } = params

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
    console.error('[ADMIN_REGENERATE_REPORT]', error)
    return NextResponse.json({ error: 'Failed to regenerate report' }, { status: 500 })
  }
}
