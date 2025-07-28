import '@/sentry.server.config'
import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';
import { getPlanFeatures } from '@/shared/subscriptionPlanUtils';


const prisma = new PrismaClient();

async function getBusinessFromToken(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return { error: 'Unauthorized', status: 401 };
    }

    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);
    if (!valid || decoded.role !== 'BUSINESS_OWNER') {
      return { error: 'Forbidden', status: 403 };
    }

    const business = await prisma.business.findFirst({
      where: { ownerId: decoded.userId },
    });

    if (!business) {
      return { error: 'Business not found', status: 404 };
    }

    Sentry.setUser({ id: decoded.userId, role: decoded.role });

    return { business };
  } catch (error) {
    Sentry.captureException(error);
    return { error: 'Token validation error', status: 500 };
  }
}

export async function GET(request) {
  try {
    const { business, error, status } = await getBusinessFromToken(request);
    if (error) return NextResponse.json({ error }, { status });

    const features = getPlanFeatures(business.plan);
    if (!features.canAccessReports) {
      Sentry.captureMessage(`Blocked report access for business ${business.id} (Plan: ${business.plan})`);

      return NextResponse.json(
        {
          error: 'Your plan does not support access to reports.',
          suggestion: 'Upgrade your plan to unlock business reports.',
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period');

    const whereClause = {
      businessId: business.id,
      ...(period && { period }),
    };

    const reports = await prisma.monthlyReport.findMany({
      where: whereClause,
      orderBy: { period: 'desc' },
    });

    return NextResponse.json({ reports }, { status: 200 });
  } catch (err) {
    Sentry.captureException(err);
    console.error('GET /manager/reports error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
