import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';
import { createNotification } from '@/shared/notifications/createNotification'; 
import { staffLimitByPlan } from '@/shared/subscriptionPlanUtils';

const prisma = new PrismaClient();

async function getOwnerBusiness(userId) {
  return prisma.business.findFirst({ where: { ownerId: userId } });
}

// ✅ Direct add: set user role to STAFF, set name, and create/approve StaffEnrollment for this business
export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);
    if (!valid || decoded.role !== 'BUSINESS_OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const business = await getOwnerBusiness(decoded.userId);
    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const { userId, firstName, lastName } = body || {};
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Validate MongoDB ObjectId format (24 hex characters)
    if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
      return NextResponse.json({ error: 'Invalid userId format. Must be a valid MongoDB ObjectId' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Do not override privileged roles
    if (user.role === 'ADMIN' || user.role === 'BUSINESS_OWNER') {
      return NextResponse.json({ error: 'Cannot change role for this account' }, { status: 400 });
    }

    const fullName = `${firstName || ''} ${lastName || ''}`.trim() || user.name || null;

    // 1) Promote to STAFF + set name (single "name" field in schema)
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: 'STAFF', ...(fullName ? { name: fullName } : {}) },
      select: { id: true, name: true, email: true, role: true },
    });

    // 2) Ensure StaffEnrollment exists and is APPROVED for this business
    const existing = await prisma.staffEnrollment.findFirst({
      where: { userId, businessId: business.id },
      select: { id: true, status: true },
    });

    if (!existing) {
      // Model requires idNumber/idPhotoUrl/selfieWithIdUrl → use placeholders for direct add.
      await prisma.staffEnrollment.create({
        data: {
          userId,
          businessId: business.id,
          idNumber: '',
          idPhotoUrl: '',
          selfieWithIdUrl: '',
          status: 'APPROVED',
          reviewedAt: new Date(),
        },
      });
    } else if (existing.status !== 'APPROVED') {
      await prisma.staffEnrollment.update({
        where: { id: existing.id },
        data: { status: 'APPROVED', reviewedAt: new Date() },
      });
    }

    return NextResponse.json({ message: 'Staff added', staff: updatedUser }, { status: 201 });
  } catch (e) {
    Sentry.captureException(e);
    console.error('POST /manager/staff (direct add) error:', e);
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

        if (!valid || decoded.role !== 'BUSINESS_OWNER') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const business = await prisma.business.findFirst({
            where: { ownerId: decoded.userId },
        });

        if (!business) {
            return NextResponse.json({ error: 'Business not found' }, { status: 404 });
        }

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
        return NextResponse.json({ approvedStaff, pendingEnrollments }, { status: 200 });
    } catch (error) {
        Sentry.captureException(error);
        console.error('GET /manager/me/staff error:', error);
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

        if (!valid || decoded.role !== 'BUSINESS_OWNER') {
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

        const enrollment = await prisma.staffEnrollment.update({
            where: { id: enrollmentId },
            data: {
                status,
                reviewedAt: new Date()
            },
            include: { user: true, business: true }
        });

        if (status === 'APPROVED') {
        const business = await prisma.business.findUnique({
           where: { id: existing.businessId },
           select: { plan: true },
         });

          const approvedCount = await prisma.staffEnrollment.count({
           where: {
            businessId: existing.businessId,
            status: 'APPROVED',
           },
          });

          const allowed = staffLimitByPlan[business.plan] || 0;

       
          const extraAddOn = await prisma.addOn.findFirst({
            where: {
                 businessId: existing.businessId,
                type: 'EXTRA_STAFF',
                isActive: true
            }
          });

            const extraAllowed = extraAddOn?.value || 0;
            const totalAllowed = allowed + extraAllowed;

         if (approvedCount >= totalAllowed) {
            await createNotification({
                 userId: decoded.userId,
                 type: 'SYSTEM',
                 title: 'Staff Limit Reached',
                 message: `Your current plan only allows ${totalAllowed} staff members. Upgrade or purchase an add-on to approve more.`,
            });

            Sentry.captureMessage(`Staff limit reached for business ${enrollment.businessId}. Plan: ${business.plan}, Allowed: ${totalAllowed}, Attempted by user: ${decoded.userId}`);

            return NextResponse.json({
             error: `Your staff limit (${totalAllowed}) has been reached.`,
            suggestion: `Please upgrade your subscription or purchase an 'Extra Staff Add-on' to approve more staff.`,
             }, { status: 403 });
        }

          await prisma.business.update({
           where: { id: enrollment.businessId },
           data: {
            staff: {
              connect: { id: enrollment.userId }
            }
          }
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

        if (!valid || decoded.role !== 'BUSINESS_OWNER') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const staffId = searchParams.get('id');

        if (!staffId) {
            return NextResponse.json({ error: 'Missing staff ID' }, { status: 400 });
        }

        const business = await prisma.business.findFirst({
            where: { ownerId: decoded.userId }
        });

        if (!business) {
            return NextResponse.json({ error: 'Business not found' }, { status: 404 });
        }

        await prisma.business.update({
            where: { id: business.id },
            data: {
                staff: {
                    disconnect: { id: staffId }
                }
            }
        });

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