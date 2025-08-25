// apps/backend/src/app/api/admin/businesses/[id]/route.js
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { requireAuth } from '@/lib/token';

const prisma = globalThis.__prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalThis.__prisma = prisma;

function ensureAdmin(user) {
  const role = String(user?.role || '').toUpperCase();
  return ['ADMIN', 'SUPER_ADMIN', 'CREATOR'].includes(role);
}

export async function GET(request, { params }) {
  let admin;
  let businessId; // make visible to catch()
  try {
    admin = await requireAuth(request);
    if (!ensureAdmin(admin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const resolvedParams = await params;
    businessId = resolvedParams?.id;
    if (!businessId) {
      return NextResponse.json({ error: 'Business ID is required' }, { status: 400 });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        owner: {
          select: { id: true, email: true, name: true, phone: true, role: true, createdAt: true },
        },
        // 1:1 verification in new schema
        verification: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            reviewedAt: true,
            businessId: true,
            type: true,
            idNumber: true,
            licenseUrl: true,
            regNumber: true,
            idPhotoUrl: true,
            selfieWithIdUrl: true,
          },
        },
        subscription: {
          select: { id: true, plan: true, isActive: true, startDate: true, endDate: true },
        },
        adCampaigns: {
          select: { id: true, title: true, budget: true, startDate: true, endDate: true, isActive: true },
          take: 10,
        },
        staffEnrollments: {
          select: {
            id: true,
            user: { select: { id: true, name: true, email: true, phone: true } },
            status: true,
            idNumber: true,
            idPhotoUrl: true,
            selfieWithIdUrl: true,
            submittedAt: true,
            reviewedAt: true,
          },
        },
        _count: {
          select: {
            services: true,
            adCampaigns: true,
            staffEnrollments: true,
            bookings: true,
            reviews: true,
            coupons: true,
            addOns: true,
          },
        },
      },
    });

    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    // shape for frontend
    const response = {
      id: business.id,
      name: business.name,
      description: business.description,
      createdAt: business.createdAt,
      updatedAt: business.updatedAt,
      suspended: business.suspended,
      suspendedUntil: business.suspendedUntil,
      owner: business.owner,
      verification: business.verification
        ? {
            id: business.verification.id,
            status: String(business.verification.status).toLowerCase(),
            createdAt: business.verification.createdAt,
            reviewedAt: business.verification.reviewedAt ?? null,
            type: business.verification.type,
            idNumber: business.verification.idNumber,
            licenseUrl: business.verification.licenseUrl,
            regNumber: business.verification.regNumber,
            idPhotoUrl: business.verification.idPhotoUrl,
            selfieWithIdUrl: business.verification.selfieWithIdUrl,
          }
        : null,
      subscription: business.subscription,
      adCampaigns: business.adCampaigns,
      staff: business.staffEnrollments.map(e => ({
        id: e.id,
        user: e.user,
        status: e.status,
        idNumber: e.idNumber,
        idPhotoUrl: e.idPhotoUrl,
        selfieWithIdUrl: e.selfieWithIdUrl,
        submittedAt: e.submittedAt,
        reviewedAt: e.reviewedAt,
      })),
      stats: {
        totalCampaigns: business._count.adCampaigns,
        totalStaff: business._count.staffEnrollments,
        totalBookings: business._count.bookings,
        totalReviews: business._count.reviews,
        totalServices: business._count.services,
        totalCoupons: business._count.coupons,
        totalAddOns: business._count.addOns,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('GET /api/admin/businesses/[id] failed:', error);
    Sentry.captureException(error, {
      extra: { route: 'GET /api/admin/businesses/[id]', businessId, adminId: admin?.id },
    });
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  let admin;
  let businessId;
  try {
    admin = await requireAuth(request);
    if (!ensureAdmin(admin)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const resolvedParams = await params;
    businessId = resolvedParams?.id;
    if (!businessId) return NextResponse.json({ error: 'Business ID is required' }, { status: 400 });

    const url = new URL(request.url);
    const hardDelete = url.searchParams.get('hard') === 'true';

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, owner: { select: { id: true, email: true, name: true } } },
    });
    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    if (hardDelete) {
      await prisma.$transaction(async tx => {
        await tx.adCampaign.deleteMany({ where: { businessId } });
        await tx.staffEnrollment.deleteMany({ where: { businessId } });
        await tx.businessVerification.deleteMany({ where: { businessId } });
        await tx.subscriptionPayment.deleteMany({ where: { businessId } });
        await tx.payment.deleteMany({ where: { businessId } });
        await tx.subscription.deleteMany({ where: { businessId } });
        await tx.booking.deleteMany({ where: { businessId } });
        await tx.review.deleteMany({ where: { businessId } });
        await tx.service.deleteMany({ where: { businessId } });
        await tx.coupon.deleteMany({ where: { businessId } });
        await tx.addOn.deleteMany({ where: { businessId } });
        await tx.promoRedemption.updateMany({ where: { businessId }, data: { businessId: null, consumedAt: new Date() } });
        await tx.business.delete({ where: { id: businessId } });
      });

      return NextResponse.json({ message: 'Business permanently deleted', type: 'hard_delete' });
    }

    // soft delete: mark suspended + log it
    const updated = await prisma.business.update({
      where: { id: businessId },
      data: {
        name: `BANNED_${business.id}`,
        description: 'Business has been banned by admin',
        suspended: true,
        suspendedUntil: null,
      },
      select: { id: true },
    });

    await prisma.suspensionLog.create({
      data: {
        businessId,
        adminId: admin.id,
        action: 'BAN',
        reason: 'Banned via admin panel',
      },
    });

    return NextResponse.json({ message: 'Business banned successfully', type: 'soft_delete', id: updated.id });
  } catch (error) {
    console.error('DELETE /api/admin/businesses/[id] failed:', error);
    Sentry.captureException(error, { extra: { route: 'DELETE /api/admin/businesses/[id]', businessId, adminId: admin?.id } });
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  let admin;
  let businessId;
  try {
    admin = await requireAuth(request);
    if (!ensureAdmin(admin)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const resolvedParams = await params;
    businessId = resolvedParams?.id;
    if (!businessId) return NextResponse.json({ error: 'Business ID is required' }, { status: 400 });

    const body = await request.json();
    const { suspended, suspendedUntil, name, description } = body;

    const updateData = {};
    if (typeof suspended === 'boolean') updateData.suspended = suspended;
    if (suspendedUntil !== undefined) updateData.suspendedUntil = suspendedUntil ? new Date(suspendedUntil) : null;
    if (typeof name === 'string' && name.trim()) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;

    const updated = await prisma.business.update({
      where: { id: businessId },
      data: updateData,
      select: { id: true, name: true, description: true, suspended: true, suspendedUntil: true, updatedAt: true },
    });

    return NextResponse.json({ message: 'Business updated successfully', business: updated });
  } catch (error) {
    console.error('PATCH /api/admin/businesses/[id] failed:', error);
    Sentry.captureException(error, { extra: { route: 'PATCH /api/admin/businesses/[id]', businessId, adminId: admin?.id } });
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  let admin;
  let businessId;

  try {
    admin = await requireAuth(request);
    if (!ensureAdmin(admin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const resolvedParams = await params;
    businessId = resolvedParams?.id;
    if (!businessId) {
      return NextResponse.json({ error: 'Business ID is required' }, { status: 400 });
    }

    console.log('🔍 Approving business:', businessId);

    // optional note in request body
    let note = '';
    try {
      const body = await request.json();
      note = body?.note || '';
    } catch {
      // No body or invalid JSON, continue without note
    }

    // load business + verification
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        ownerId: true,
        owner: { select: { id: true, name: true, email: true } },
        verification: { select: { id: true, status: true } },
      },
    });

    if (!business) {
      console.log('❌ Business not found:', businessId);
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    if (!business.verification) {
      console.log('❌ No verification record for business:', businessId);
      return NextResponse.json({ error: 'No verification record to approve' }, { status: 400 });
    }

    if (business.verification.status === 'APPROVED') {
      console.log('ℹ️ Business already approved:', businessId);
      return NextResponse.json({ message: 'Already approved' });
    }

    console.log('✅ Approving verification for business:', businessId);

    // approve the verification
    const verification = await prisma.businessVerification.update({
      where: { businessId },
      data: { status: 'APPROVED', reviewedAt: new Date() },
      select: { id: true, status: true, reviewedAt: true },
    });

    // notify owner (optional but nice)
    try {
      await prisma.notification.create({
        data: {
          userId: business.ownerId,
          type: 'APPLICATION',
          title: 'Your business was approved 🎉',
          message:
            `Good news! "${business.name}" has been approved.` +
            (note ? ` Note from admin: ${note}` : ''),
        },
      });
      console.log('📧 Notification sent to owner:', business.owner.email);
    } catch (notificationError) {
      console.warn('⚠️ Failed to create notification:', notificationError.message);
      // Don't fail the whole request if notification fails
    }

    console.log('🎉 Business approved successfully:', businessId);

    return NextResponse.json({
      message: 'Business approved successfully',
      verification,
      business: {
        id: business.id,
        name: business.name,
      },
    });

  } catch (err) {
    console.error('💥 POST /api/admin/businesses/[id]/approve failed:', err);
    console.error('Error details:', {
      message: err?.message,
      stack: err?.stack,
      name: err?.name,
      cause: err?.cause,
      code: err?.code,
      meta: err?.meta
    });

    Sentry.captureException(err, {
      extra: { 
        route: 'POST /api/admin/businesses/[id]/approve', 
        businessId, 
        adminId: admin?.id,
        errorDetails: {
          message: err?.message,
          name: err?.name,
          code: err?.code,
          meta: err?.meta
        }
      },
    });

    return NextResponse.json({ 
      error: err?.message || 'Failed to approve business',
      details: process.env.NODE_ENV === 'development' ? err?.stack : undefined
    }, { status: 500 });
  }
}

// Handle preflight requests for CORS
export async function OPTIONS() {
  return NextResponse.json({}, { status: 204 });
}