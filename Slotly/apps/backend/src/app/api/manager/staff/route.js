import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';
import { createNotification } from '@/shared/notifications/createNotification'; 
import { staffLimitByPlan } from '@/shared/subscriptionPlanUtils';

const prisma = new PrismaClient();

async function getBusinessForOwner(ownerId, businessId) {
  if (businessId) {
    const b = await prisma.business.findUnique({ where: { id: businessId } });
    if (!b) return { error: 'Business not found', status: 404 };
    if (b.ownerId !== ownerId) return { error: 'Forbidden', status: 403 };
    return { business: b };
  }
  const b = await prisma.business.findFirst({ where: { ownerId } });
  if (!b) return { error: 'Business not found', status: 404 };
  return { business: b };
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);
    const ownerId = decoded?.userId ?? decoded?.id ?? decoded?.sub;

    if (!valid || decoded?.role !== 'BUSINESS_OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { userId, firstName, lastName, businessId, approveNow = false } = body || {};
    const result = await getBusinessForOwner(ownerId, businessId);
    if (!result.business) return NextResponse.json({ error: result.error }, { status: result.status });
    const business = result.business;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }
    if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
      return NextResponse.json({ error: 'Invalid userId format. Must be a valid MongoDB ObjectId' }, { status: 400 });
    }

    // --- Direct add path (approve immediately) enforces limits; plain enrollment does not ---
    if (approveNow) {
      const approvedCount = await prisma.staffEnrollment.count({
        where: { businessId: business.id, status: 'APPROVED' },
      });
      const baseAllowed = staffLimitByPlan[business.plan] || 0;
      const extraAddOn = await prisma.addOn.findFirst({
        where: { businessId: business.id, type: 'EXTRA_STAFF', isActive: true },
        select: { value: true },
      });
      const extra = Number(extraAddOn?.value ?? 0);
      const totalAllowed = baseAllowed + extra;
      const alreadyApproved = await prisma.staffEnrollment.findFirst({
        where: { businessId: business.id, userId, status: 'APPROVED' },
        select: { id: true },
      });
      if (!alreadyApproved && approvedCount >= totalAllowed) {
        return NextResponse.json(
          { error: `Your staff limit (${totalAllowed}) has been reached.`, suggestion: `Upgrade or purchase an Extra Staff add-on.` },
          { status: 403 }
        );
      }
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // We only touch the role on direct-add
    if (approveNow && (user.role === 'ADMIN' || user.role === 'BUSINESS_OWNER')) {
      return NextResponse.json({ error: 'Cannot change role for this account' }, { status: 400 });
    }

    let updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, phone: true, createdAt: true },
    });
    const fullName = `${firstName || ''} ${lastName || ''}`.trim() || updatedUser?.name || null;
    
    if (approveNow) {
      updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { role: 'STAFF', ...(fullName ? { name: fullName } : {}) },
        select: { id: true, name: true, email: true, role: true, phone: true, createdAt: true },
      });
    } else if (fullName && !updatedUser?.name) {
      // Optional: if you want to set name on enrollment even if not approving:
      updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { name: fullName },
        select: { id: true, name: true, email: true, role: true, phone: true, createdAt: true },
      });
    }

    // 2) Ensure StaffEnrollment exists (APPROVED if direct add, else PENDING)
    const existing = await prisma.staffEnrollment.findFirst({
      where: { userId, businessId: business.id },
      select: { id: true, status: true },
    });

    if (!existing) {
      await prisma.staffEnrollment.create({
        data: {
          userId,
          businessId: business.id,
          idNumber: '',
          idPhotoUrl: '',
          selfieWithIdUrl: '',
          status: approveNow ? 'APPROVED' : 'PENDING',
          reviewedAt: approveNow ? new Date() : null,
        },
      });
    } else if (approveNow && existing.status !== 'APPROVED') {
      await prisma.staffEnrollment.update({
        where: { id: existing.id },
        data: { status: 'APPROVED', reviewedAt: new Date() },
      });
    }

    return NextResponse.json(
      approveNow
        ? { message: 'Staff added', staff: updatedUser, businessId: business.id }
        : { message: 'Enrollment submitted', enrollment: { userId, businessId: business.id, status: 'PENDING' } },
      { status: 201 }
    );
  } catch (e) {
    Sentry.captureException(e);
    console.error('POST /manager/staff error:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const { valid, decoded } = await verifyToken(token);
        const ownerId = decoded?.userId ?? decoded?.id ?? decoded?.sub;

        if (!valid || decoded?.role !== 'BUSINESS_OWNER') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const businessId = searchParams.get('businessId') || undefined;
        const { business, error, status } = await getBusinessForOwner(ownerId, businessId);
        if (!business) return NextResponse.json({ error }, { status });

        const approvedEnrollments = await prisma.staffEnrollment.findMany({
            where: {
                businessId: business.id,
                status: 'APPROVED'
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        createdAt: true
                    }
                }
            }
        });

        const approvedStaff = approvedEnrollments.map(e => e.user);

        const pendingEnrollments = await prisma.staffEnrollment.findMany({
            where: {
                businessId: business.id,
                status: 'PENDING'
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true
                    }
                }
            }
        });

        // --- Expose plan-based limits so the app can show remaining slots
        const baseAllowed = staffLimitByPlan[business.plan] || 0;
        const extraAddOn = await prisma.addOn.findFirst({
            where: { businessId: business.id, type: 'EXTRA_STAFF', isActive: true },
            select: { value: true },
        });
        const totalAllowed = baseAllowed + (extraAddOn?.value || 0);
        const approvedCount = approvedEnrollments.length;
        const remaining = Math.max(0, totalAllowed - approvedCount);

        return NextResponse.json({
            approvedStaff,
            pendingEnrollments,
            limits: {
                plan: business.plan,
                baseAllowed,
                extraAllowed: extraAddOn?.value || 0,
                totalAllowed,
                approvedCount,
                remaining,
            }
        }, { status: 200 });
    } catch (error) {
        Sentry.captureException(error);
        console.error('GET /manager/staff error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const { valid, decoded } = await verifyToken(token);
        const ownerId = decoded?.userId ?? decoded?.id ?? decoded?.sub;

        if (!valid || decoded?.role !== 'BUSINESS_OWNER') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { enrollmentId, status } = await request.json();

        if (!['APPROVED', 'REJECTED'].includes(status)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }

        const existing = await prisma.staffEnrollment.findUnique({
            where: { id: enrollmentId }
        });

        if (!existing) {
            return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
        }

        if (existing.status === 'APPROVED' && status === 'APPROVED') {
            return NextResponse.json({ error: 'Staff is already approved' }, { status: 400 });
        }

        // Ensure the current owner actually owns this enrollment's business
        const biz = await prisma.business.findUnique({
            where: { id: existing.businessId },
            select: { ownerId: true, plan: true },
        });
        if (!biz || biz.ownerId !== ownerId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // If approving, enforce plan limits BEFORE updating status
        if (status === 'APPROVED') {
            const approvedCount = await prisma.staffEnrollment.count({
                where: { businessId: existing.businessId, status: 'APPROVED' },
            });
            const baseAllowed = staffLimitByPlan[biz.plan] || 0;
            const extraAddOn = await prisma.addOn.findFirst({
                where: { businessId: existing.businessId, type: 'EXTRA_STAFF', isActive: true },
                select: { value: true },
            });
            const totalAllowed = baseAllowed + (extraAddOn?.value || 0);

            // Block if approving this one would exceed the cap
            if (approvedCount >= totalAllowed) {
                await createNotification({
                    userId: ownerId,
                    type: 'SYSTEM',
                    title: 'Staff Limit Reached',
                    message: `Your current plan only allows ${totalAllowed} staff members. Upgrade or purchase an add-on to approve more.`,
                });
                return NextResponse.json({
                    error: `Your staff limit (${totalAllowed}) has been reached.`,
                    suggestion: `Please upgrade your subscription or purchase an 'Extra Staff Add-on' to approve more staff.`,
                }, { status: 403 });
            }
        }

        const enrollment = await prisma.staffEnrollment.update({
            where: { id: enrollmentId },
            data: {
                status,
                reviewedAt: new Date()
            },
            include: { user: true, business: true }
        });

        // Finally, on approval set the role (limit already checked)
        if (status === 'APPROVED') {
            await prisma.user.update({
                where: { id: enrollment.userId },
                data: { role: 'STAFF' }
            });
        }

        await createNotification({
            userId: enrollment.userId,
            type: 'STAFF_ASSIGNMENT',
            title: status === 'APPROVED' ? 'Application Approved' : 'Application Rejected',
            message:
                status === 'APPROVED'
                    ? `Congratulations! You have been approved as staff at ${enrollment.business?.name || 'the business'}.`
                    : `Sorry, your application to join ${enrollment.business?.name || 'the business'} was rejected.`,
            metadata: { enrollmentId: enrollment.id, businessId: enrollment.businessId }
        });

        return NextResponse.json(
            { message: `Staff ${status.toLowerCase()} successfully`, enrollment },
            { status: 200 }
        );
    } catch (error) {
        Sentry.captureException(error);
        console.error('PUT /manager/staff error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const { valid, decoded } = await verifyToken(token);
        const ownerId = decoded?.userId ?? decoded?.id ?? decoded?.sub;

        if (!valid || decoded?.role !== 'BUSINESS_OWNER') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const staffId = searchParams.get('id');
        const businessId = searchParams.get('businessId') || undefined;

        if (!staffId) {
            return NextResponse.json({ error: 'Missing staff ID' }, { status: 400 });
        }

        const { business, error, status } = await getBusinessForOwner(ownerId, businessId);
        if (!business) return NextResponse.json({ error }, { status });

        await prisma.staffEnrollment.updateMany({
            where: {
                userId: staffId,
                businessId: business.id
            },
            data: {
                status: 'REJECTED',
                reviewedAt: new Date()
            }
        });

        const removedStaff = await prisma.user.findUnique({
            where: { id: staffId },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true
            }
        });

        return NextResponse.json({ message: 'Staff removed successfully', removedStaff }, { status: 200 });

    } catch (error) {
        Sentry.captureException(error);
        console.error('DELETE /manager/staff error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}