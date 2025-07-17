import '@/sentry.server.config'; 
import { NextResponse } from 'next/server';
import prisma from '@/generated/prisma';
import * as Sentry from '@sentry/nextjs';

export async function GET(request, { params }) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
    }

    const ad = await prisma.adCampaign.findUnique({
      where: { id },
      include: { business: true },
    });

    if (!ad) {
      return NextResponse.json({ error: 'Ad campaign not found' }, { status: 404 });
    }

    return NextResponse.json(ad);
  } catch (error) {
    Sentry.captureException(error, {
      extra: { route: 'GET /adCampaign/:id', params },
    });
    console.error('Error fetching ad campaign:', error);
    return NextResponse.json({ error: 'Failed to fetch ad campaign' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const role = request.headers.get('x-user-role');

    if (role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden: Only OWNER can update ad campaigns' }, { status: 403 });
    }

    const { title, budget, startDate, endDate, isActive } = await request.json();

    const updated = await prisma.adCampaign.update({
      where: { id },
      data: {
        title,
        budget: budget ?? 0,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: isActive !== undefined ? isActive : new Date(endDate) > new Date(),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    Sentry.captureException(error, {
      extra: { route: 'PUT /adCampaign/:id', params },
    });
    console.error('Error updating ad campaign:', error);
    return NextResponse.json({ error: 'Failed to update ad campaign' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    const role = request.headers.get('x-user-role');

    if (role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden: Only OWNER can delete ad campaigns' }, { status: 403 });
    }

    const deleted = await prisma.adCampaign.delete({
      where: { id },
    });

    return NextResponse.json(deleted);
  } catch (error) {
    Sentry.captureException(error, {
      extra: { route: 'DELETE /adCampaign/:id', params },
    });
    console.error('Error deleting ad campaign:', error);
    return NextResponse.json({ error: 'Failed to delete ad campaign' }, { status: 500 });
  }
}
