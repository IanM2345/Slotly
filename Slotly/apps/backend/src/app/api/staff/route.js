// File: apps/backend/src/app/api/staff/route.js
// Main staff context helper and introspection endpoint

import * as Sentry from '@sentry/nextjs';
import prisma from '@/generated/prisma';
import { NextResponse } from 'next/server';
import { verifyToken } from '@/middleware/auth';



// Small helper to format JSON consistently
function j(data, status = 200, headers = {}) {
  return NextResponse.json(data, { status, headers });
}

/**
 * Returns a normalized context for STAFF/BUSINESS_OWNER calls:
 *  - Verifies Bearer token
 *  - Ensures role is STAFF or BUSINESS_OWNER
 *  - Resolves approved enrollments for the user
 *  - Chooses an active business (by ?businessId=... or first approved)
 *
 * Usage:
 *   const ctx = await getStaffContext(req);
 *   if (ctx.error) return ctx.response; // early exit with proper HTTP status
 *   // else ctx.userId, ctx.business, ctx.enrollments
 */
async function getStaffContext(request) {
  try {
    const auth =
      request.headers.get('authorization') ||
      request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return {
        error: 'Unauthorized',
        response: j({ error: 'Unauthorized' }, 401),
      };
    }

    const token = auth.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);
    if (!valid || !decoded?.userId || !['STAFF', 'BUSINESS_OWNER'].includes(decoded.role)) {
      return { error: 'Forbidden', response: j({ error: 'Forbidden' }, 403) };
    }

    const url = new URL(request.url);
    const businessId = url.searchParams.get('businessId') || undefined;

    // All approved enrollments for this staffer
    const enrollments = await prisma.staffEnrollment.findMany({
      where: { userId: decoded.userId, status: 'APPROVED' },
      select: {
        businessId: true,
        business: { select: { id: true, name: true, logoUrl: true } },
        reviewedAt: true,
      },
      orderBy: { reviewedAt: 'desc' },
    });

    if (!enrollments.length) {
      return {
        error: 'No approved business enrollment',
        response: j({ error: 'No approved business enrollment' }, 403),
      };
    }

    const chosen = businessId
      ? enrollments.find((e) => e.businessId === businessId)
      : enrollments[0];

    if (!chosen) {
      return {
        error: 'Not enrolled in this business',
        response: j({ error: 'Not enrolled in this business' }, 403),
      };
    }

    // Tag Sentry for better traces
    try {
      Sentry.setUser({ id: decoded.userId, role: decoded.role });
      Sentry.setTag('active_business_id', chosen.business.id);
    } catch {}

    return {
      userId: decoded.userId,
      role: decoded.role,
      business: chosen.business,
      enrollments: enrollments.map((e) => e.business),
      ok: true,
    };
  } catch (err) {
    Sentry.captureException?.(err);
    return {
      error: 'Internal Server Error',
      response: j({ error: 'Internal Server Error' }, 500),
    };
  }
}

// Optional GET just to introspect the context quickly if you hit /api/staff directly
export async function GET(request) {
  const ctx = await getStaffContext(request);
  if (ctx?.error) return ctx.response;
  return j({
    ok: true,
    userId: ctx.userId,
    activeBusiness: ctx.business,
    businesses: ctx.enrollments,
  });
}