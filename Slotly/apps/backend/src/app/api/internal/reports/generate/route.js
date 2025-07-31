import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';
import { getPlanFeatures } from '@/shared/subscriptionPlanUtils';
import { runMonthlyReportRunner } from '@/reports/monthlyReportRunner';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);

    if (!valid || decoded.role !== 'BUSINESS_OWNER') {
      return NextResponse.json({ error: 'Forbidden: Only business owners allowed' }, { status: 403 });
    }

    const business = await prisma.business.findFirst({
      where: { ownerId: decoded.id },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const features = getPlanFeatures(business.plan);
    if (!features.canAccessReports) {
      return NextResponse.json({
        error: 'Your subscription plan does not support report generation.',
        suggestion: 'Upgrade your plan to access reports.',
      }, { status: 403 });
    }

    await runMonthlyReportRunner();

    return NextResponse.json({
      message: '✅ Monthly reports generated and archived successfully.',
    }, { status: 200 });

  } catch (error) {
    console.error('❌ Error generating reports:', error);
    Sentry.captureException(error);
    return NextResponse.json({
      error: 'Failed to generate reports.',
    }, { status: 500 });
  }
}