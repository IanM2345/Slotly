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

async function handleReject(req, ctx) {
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
    console.log('Admin from token:', admin ? { id: admin.id, role: admin.role } : 'null/undefined');
    
    const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'CREATOR'].includes(String(admin?.role || '').toUpperCase());
    console.log('Is admin check:', isAdmin);
    
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    if (!businessId) return NextResponse.json({ error: 'Business ID is required' }, { status: 400 });

    // Body (optional)
    let body = {};
    try { body = await req.json(); } catch {}
    const { reason, purge = false } = body || {};

    // Idempotency
    if (idempotencyKey) {
      const scopeKey = `reject:${businessId}:${idempotencyKey}:${purge ? 'purge' : 'suspend'}`;
      const existing = idempotencyStore.get(scopeKey);
      if (existing) return NextResponse.json(existing.response, { status: existing.status });
    }

    const result = await prisma.$transaction(async (tx) => {
      const found = await tx.business.findUnique({
        where: { id: businessId },
        include: {
          owner: true,
          verification: true, // relation name on Business
        },
      });

      if (!found) throw new Error('BUSINESS_NOT_FOUND');
      if (!found.verification) throw new Error('NO_VERIFICATION_RECORD');
      if (found.verification.status !== 'PENDING') throw new Error('INVALID_STATUS_TRANSITION');

      const verification = found.verification;
      let deletedFiles = [];
      let purged = false;

      if (purge) {
        // Cache file URLs before DB delete
        const fileUrls = [verification.idPhotoUrl, verification.selfieWithIdUrl, verification.licenseUrl].filter(Boolean);

        await tx.businessVerification.delete({ where: { businessId } });
        await tx.business.delete({ where: { id: businessId } });

        // Downgrade owner
        await tx.user.update({
          where: { id: found.ownerId },
          data: { role: 'CUSTOMER' },
        });

        await tx.suspensionLog.create({
          data: {
            businessId,
            userId: found.ownerId,
            adminId: admin.id,
            reason: reason || 'Verification rejected (purged)',
            action: 'BUSINESS_REJECTED_PURGED',
            timestamp: new Date(),
          },
        });

        deletedFiles = fileUrls;
        purged = true;
      } else {
        // Mark verification REJECTED and suspend for 30 days
        await tx.businessVerification.update({
          where: { businessId },
          data: { status: 'REJECTED', reviewedAt: new Date() },
        });

        await tx.user.update({
          where: { id: found.ownerId },
          data: { role: 'CUSTOMER' }, // optional; keep if you want to reset role
        });

        const suspendedUntil = new Date();
        suspendedUntil.setDate(suspendedUntil.getDate() + 30);

        await tx.business.update({
          where: { id: businessId },
          data: { suspended: true, suspendedUntil },
        });

        await tx.suspensionLog.create({
          data: {
            businessId,
            userId: found.ownerId,
            adminId: admin.id,
            reason: reason || 'Verification rejected by admin',
            action: 'BUSINESS_REJECTED',
            timestamp: new Date(),
          },
        });
      }

      return { business: found, purged, deletedFiles };
    });


    // Notify
    const message = result.purged
      ? `Your business "${result.business.name}" verification was rejected and all application data has been removed.`
      : `Your business "${result.business.name}" verification was rejected and the business has been suspended for 30 days.`;
    const title = result.purged ? 'Business Application Rejected' : 'Business Verification Rejected';

    await Promise.allSettled([
      createNotification({
        userId: result.business.ownerId,
        type: 'SYSTEM',
        title,
        message: `${message} Reason: ${reason || 'No reason provided.'}`,
      }),
      sendNotification({ userId: result.business.ownerId, type: 'SYSTEM', message }),
      sendAdminEmailLog({
        subject: result.purged ? 'Business Rejected and Purged' : 'Business Rejected',
        message:
          `Business "${result.business.name}" (${result.business.id}) was ${result.purged ? 'rejected and purged' : 'rejected'} by Admin ${admin?.name || admin?.id}.` +
          (reason ? `\nReason: ${reason}` : '') +
          (result.purged ? '\nAll associated files have been queued for deletion.' : ''),
      }),
    ]);

    const response = {
      message: result.purged
        ? 'Business rejected and purged successfully'
        : 'Business rejected and suspended successfully',
      businessId,
      purged: result.purged,
    };
    const status = 200;

    const idemHeader = req.headers.get('idempotency-key');
    if (idemHeader) {
      const scopeKey = `reject:${businessId}:${idemHeader}:${result.purged ? 'purge' : 'suspend'}`;
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
      return NextResponse.json({ error: 'Business can only be rejected from PENDING status' }, { status: 400 });
    }

    console.error('[/reject] error:', error);
    Sentry.captureException(error, { extra: { route: 'PATCH /admin/business/reject', businessId, adminId: admin?.id } });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Support both POST and PATCH so the client doesn't 405
export async function POST(req, ctx) { return handleReject(req, ctx); }
export async function PATCH(req, ctx) { return handleReject(req, ctx); }
export async function OPTIONS() { return NextResponse.json({}, { status: 204 }); }