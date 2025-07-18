import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';
import { createNotification } from '@/shared/notifications/createNotification'; 

const prisma = new PrismaClient();

export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);

    if (!valid || decoded.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { businessId, idNumber, idPhotoUrl, selfieWithIdUrl } = body;

    if (!businessId || !idNumber || !idPhotoUrl || !selfieWithIdUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const existingApp = await prisma.staffEnrollment.findFirst({
      where: {
        businessId,
        userId: decoded.id,
      },
    });

    if (existingApp) {
      return NextResponse.json(
        { error: 'You have already applied to this business' },
        { status: 409 }
      );
    }

    const newApplication = await prisma.staffEnrollment.create({
      data: {
        businessId,
        userId: decoded.id,
        idNumber,
        idPhotoUrl,
        selfieWithIdUrl,
      },
    });

    await createNotification({
      userId: business.ownerId,
      type: 'STAFF_ASSIGNMENT',
      title: 'New Staff Application',
      message: `You have received a new staff application.`,
      metadata: { applicationId: newApplication.id, applicantId: decoded.id }
    });

    return NextResponse.json(newApplication, { status: 201 });
  } catch (error) {
    Sentry.captureException?.(error);
    console.error('Error processing application:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
