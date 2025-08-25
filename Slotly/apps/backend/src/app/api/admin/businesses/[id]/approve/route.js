import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';
import { createNotification } from '@/shared/notifications/createNotification';
import { sendNotification } from '@/shared/notifications/sendNotification';
import { sendAdminEmailLog } from '@/shared/notifications/sendAdminEmailLog';

const prisma = globalThis.__prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalThis.__prisma = prisma;

// In-memory store for idempotency keys (use Redis in production)
const idempotencyStore = new Map();

async function handleApprove(req, ctx) {
  let admin;
  let businessId;

  try {
    // ✅ FIX: await params before using
    const resolvedParams = await ctx.params;
    businessId = resolvedParams?.id;

    const authHeader = req.headers.get('authorization');
    const token = authHeader?.split(' ')[1];
    const idempotencyKey = req.headers.get('idempotency-key') || null;

    // Debug logging
    console.log('Auth header:', authHeader ? 'Present' : 'Missing');
    console.log('Token extracted:', token ? 'Present' : 'Missing');

    admin = await verifyToken(token);
    console.log('Admin from token (full object):', admin);
    
    // Handle the verifyToken response structure
    if (!admin.valid || !admin.decoded) {
      console.log('Token verification failed:', admin.error);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    // Extract user info from decoded token
    const user = admin.decoded;
    const userId = user.sub;
    const userRole = user.role;
    
    console.log('User from decoded token:', { id: userId, role: userRole });
    
    const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'CREATOR'].includes(String(userRole || '').toUpperCase());
    console.log('Is admin check:', isAdmin);
    
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    
    // Update admin object for consistent usage throughout the function
    admin = { id: userId, role: userRole };

    if (!businessId) return NextResponse.json({ error: 'Business ID is required' }, { status: 400 });

    // Idempotency (scoped by action + business)
    if (idempotencyKey) {
      const scopeKey = `approve:${businessId}:${idempotencyKey}`;
      const existing = idempotencyStore.get(scopeKey);
      if (existing) return NextResponse.json(existing.response, { status: existing.status });
    }

    // Approve inside a transaction
    const business = await prisma.$transaction(async (tx) => {
      const found = await tx.business.findUnique({
        where: { id: businessId },
        include: {
          owner: true,
          // Relation field on Business is `verification` in your schema
          verification: true,
        },
      });

      if (!found) throw new Error('BUSINESS_NOT_FOUND');
      if (!found.verification) throw new Error('NO_VERIFICATION_RECORD');
      if (found.verification.status !== 'PENDING') throw new Error('INVALID_STATUS_TRANSITION');

      // Update verification to APPROVED
      await tx.businessVerification.update({
        where: { businessId }, // businessId is unique in model
        data: { status: 'APPROVED', reviewedAt: new Date() },
      });

      // Elevate owner role
      await tx.user.update({
        where: { id: found.ownerId },
        data: { role: 'BUSINESS_OWNER' },
      });

      // Use SuspensionLog as general admin action log
      await tx.suspensionLog.create({
        data: {
          businessId,
          adminId: admin.id,
          action: 'BUSINESS_APPROVED',
          reason: 'Approved via admin panel',
          timestamp: new Date(),
        },
      });

      return found;
    });

    // Notify (outside transaction)
    await Promise.allSettled([
      createNotification({
        userId: business.ownerId,
        type: 'SYSTEM',
        title: 'Business Verification Approved',
        message: `Congrats! Your business "${business.name}" has been approved.`,
      }),
      sendNotification({
        userId: business.ownerId,
        type: 'SYSTEM',
        message: `Your business "${business.name}" has been approved.`,
      }),
      sendAdminEmailLog({
        subject: 'Business Approved',
        message: `Business "${business.name}" (${business.id}) was approved by Admin ${admin?.name || admin?.id}.`,
      }),
    ]);

    const response = { message: 'Business approved successfully', businessId };
    const status = 200;

    const idemHeader = req.headers.get('idempotency-key');
    if (idemHeader) {
      const scopeKey = `approve:${businessId}:${idemHeader}`;
      idempotencyStore.set(scopeKey, { response, status });
      setTimeout(() => idempotencyStore.delete(scopeKey), 24 * 60 * 60 * 1000);
    }

    return NextResponse.json(response, { status });
  } catch (error) {
    if (error?.message === 'BUSINESS_NOT_FOUND') {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }
    if (error?.message === 'NO_VERIFICATION_RECORD') {
      return NextResponse.json({ error: 'No verification record found' }, { status: 400 });
    }
    if (error?.message === 'INVALID_STATUS_TRANSITION') {
      return NextResponse.json({ error: 'Business can only be approved from PENDING status' }, { status: 400 });
    }

    console.error('[/approve] error:', error);
    Sentry.captureException(error, { extra: { route: 'PATCH /admin/business/approve', businessId, adminId: admin?.id } });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Support both POST and PATCH so the client doesn't 405
export async function POST(req, ctx) { return handleApprove(req, ctx); }
export async function PATCH(req, ctx) { return handleApprove(req, ctx); }
export async function OPTIONS() { return NextResponse.json({}, { status: 204 }); }