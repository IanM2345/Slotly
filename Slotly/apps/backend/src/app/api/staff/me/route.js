import '@/sentry.server.config';
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@generated/prisma';
import { verifyToken } from '@/middleware/auth';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];

    const { valid, decoded } = await verifyToken(token);
    if (!valid || !decoded?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = decoded.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        staffEnrollments: {
          include: { business: true },
        },
        staffOf: true,
      }
    });

    if (!user || user.role !== 'STAFF') {
      return NextResponse.json({ error: 'Not A Staff Member' }, { status: 401 });
    }

    const enrollment = user.staffEnrollments[0];

    if (!enrollment) {
      return NextResponse.json({ error: 'No Enrollment Found' }, { status: 404 });
    }

    const staffProfile = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      businessId: enrollment.business.id,
      businessName: enrollment.business.name,
      role: user.role,
      joinedAt: enrollment?.submittedAt,
      position: 'STAFF',
      business: enrollment?.business ? {
        id: enrollment.business.id,
        name: enrollment.business.name,
        logo: enrollment.business.logo,
        description: enrollment.business.description,
      } : null,
      enrollmentStatus: enrollment?.status || 'UNKNOWN',
    };

    return NextResponse.json({ staff: staffProfile }, { status: 200 });
  } catch (error) {
    Sentry.captureException?.(error);
    console.error('Error fetching staff profile:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
