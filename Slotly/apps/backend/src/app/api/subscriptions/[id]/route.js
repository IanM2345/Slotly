import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

// Get a subscription by ID
export async function GET(request, { params }) {
  try {
    const { id } = params;

    const subscription = await prisma.subscription.findUnique({
      where: { id },
      include: { business: true },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    return NextResponse.json(subscription, { status: 200 });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 });
  }
}

// Update a subscription
export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const { plan, startDate, endDate, isActive } = await request.json();

    const role = request.headers.get('x-user-role');
    if (role !== 'STAFF') {
      return NextResponse.json({ error: 'Forbidden: Staff only' }, { status: 403 });
    }

    if (!plan || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const updated = await prisma.subscription.update({
      where: { id },
      data: {
        plan,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: isActive !== undefined ? isActive : new Date(endDate) > new Date(),
      },
      include: { business: true },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error('Error updating subscription:', error);
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
  }
}

// Delete a subscription
export async function DELETE(request, { params }) {
  try {
    const { id } = params;

    const role = request.headers.get('x-user-role');
    if (role !== 'STAFF') {
      return NextResponse.json({ error: 'Forbidden: Staff only' }, { status: 403 });
    }

    const deleted = await prisma.subscription.delete({
      where: { id },
    });

    return NextResponse.json(deleted, { status: 200 });
  } catch (error) {
    console.error('Error deleting subscription:', error);
    return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 });
  }
}
