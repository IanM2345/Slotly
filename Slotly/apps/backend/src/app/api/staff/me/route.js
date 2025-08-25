// File: apps/backend/src/app/api/staff/me/route.js
// Staff profile and business information endpoint

import * as Sentry from '@sentry/nextjs';
import { PrismaClient } from '@/generated/prisma';
import { NextResponse } from 'next/server';
import { getStaffContext } from '../route';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const ctx = await getStaffContext(request);
    if (ctx?.error) return ctx.response;

    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { 
        id: true, 
        name: true, 
        email: true, 
        phone: true, 
        role: true,
        createdAt: true
      },
    });

    // Get enrollment details for the active business
    const enrollment = await prisma.staffEnrollment.findUnique({
      where: {
        userId_businessId: {
          userId: ctx.userId,
          businessId: ctx.business.id
        }
      },
      select: {
        submittedAt: true,
        reviewedAt: true,
        status: true
      }
    });

    const staffProfile = {
      id: user?.id || null,
      name: user?.name || null,
      email: user?.email || null,
      phone: user?.phone || null,
      role: user?.role || 'STAFF',
      joinedAt: user?.createdAt || null,
      enrollmentStatus: enrollment?.status || 'UNKNOWN',
      enrolledAt: enrollment?.submittedAt || null,
      approvedAt: enrollment?.reviewedAt || null,
    };

    return NextResponse.json({
      user: staffProfile,
      activeBusiness: ctx.business,
      businesses: ctx.enrollments || [],
    });
  } catch (err) {
    Sentry.captureException?.(err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}