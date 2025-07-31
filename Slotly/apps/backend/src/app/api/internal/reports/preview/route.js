import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';
import { generateMonthlyReport } from '@/lib/reports/pdf';
import { getBusinessFromUser } from '@/shared/authHelpers';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const url = new URL(request.url);
    const download = url.searchParams.get('download') === 'true';

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);

    if (!valid || decoded.role !== 'BUSINESS_OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const business = await getBusinessFromUser(decoded.userId);
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const data = await request.json();
    const period = data.period;
    if (!period) {
      return NextResponse.json({ error: 'Missing report period' }, { status: 400 });
    }

    
    const buffer = await generateMonthlyReport(business.id, period);

    
    await prisma.previewLog.create({
      data: {
        userId: decoded.userId,
        businessId: business.id,
        period,
      },
    });

   
    const dispositionType = download ? 'attachment' : 'inline';

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${dispositionType}; filename="slotly-report-${period}.pdf"`,
      },
    });

  } catch (error) {
    console.error('❌ Report preview error:', error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
