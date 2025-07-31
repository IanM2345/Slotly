
import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';

const prisma = new PrismaClient();
const reportsDir = path.join(process.cwd(), 'public', 'reports');

export async function GET(req, { params }) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);
    if (!valid || decoded.role !== 'BUSINESS_OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const reportId = params.id;
    const report = await prisma.monthlyReport.findUnique({ where: { id: reportId } });

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    
    const business = await prisma.business.findFirst({
      where: { id: report.businessId, ownerId: decoded.userId },
    });

    if (!business) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    
    await prisma.downloadLog.create({
      data: {
        reportId: report.id,
        userId: decoded.userId,
        downloadedAt: new Date(),
      },
    });

    const filePath = path.join(reportsDir, `${report.period}_${report.businessId}.pdf`);
    const fileBuffer = await fs.readFile(filePath);

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="slotly-report-${report.period}.pdf"`,
      },
    });

  } catch (error) {
    Sentry.captureException(error);
    console.error('❌ Download error:', error);
    return NextResponse.json({ error: 'Failed to download report' }, { status: 500 });
  }
}
