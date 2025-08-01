
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

export async function PUT(request, { params }) {
  try {
    const serviceId = params.id;
    const { name, duration, price, businessId } = await request.json();

    const role = request.headers.get('x-user-role');
    const userId = request.headers.get('x-user-id');

    if (role !== 'STAFF') {
      return NextResponse.json({ error: 'Forbidden: Staff only' }, { status: 403 });
    }

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      include: { business: { include: { staff: true } } },
    });

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    const isStaffOfBusiness = service.business.staff.some((staff) => staff.id === userId);

    if (!isStaffOfBusiness) {
      return NextResponse.json({ error: 'Forbidden: Not authorized for this business' }, { status: 403 });
    }

    const updated = await prisma.service.update({
      where: { id: serviceId },
      data: { name, duration, price, businessId },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    Sentry.captureException?.(error);
    console.error('Error updating service:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const serviceId = params.id;

    const role = request.headers.get('x-user-role');
    const userId = request.headers.get('x-user-id');

    if (role !== 'STAFF') {
      return NextResponse.json({ error: 'Forbidden: Staff only' }, { status: 403 });
    }

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      include: { business: { include: { staff: true } } },
    });

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    const isStaffOfBusiness = service.business.staff.some((staff) => staff.id === userId);

    if (!isStaffOfBusiness) {
      return NextResponse.json({ error: 'Forbidden: Not authorized for this business' }, { status: 403 });
    }

    await prisma.service.delete({
      where: { id: serviceId },
    });

    return NextResponse.json({ message: 'Service deleted successfully' }, { status: 200 });
  } catch (error) {
    Sentry.captureException?.(error);
    console.error('Error deleting service:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
