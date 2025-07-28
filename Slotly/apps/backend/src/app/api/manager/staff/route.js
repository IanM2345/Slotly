import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';
import { createNotification } from '@/shared/notifications/createNotification'; 
import { staffLimitByPlan } from '@/shared/subscriptionPlanUtils';


const prisma = new PrismaClient();

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
