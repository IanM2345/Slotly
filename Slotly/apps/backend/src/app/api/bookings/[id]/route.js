import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

// Update a booking
export async function PUT(request, context) {
  try {
    const { id } = context.params;
    const data = await request.json();
    const { startTime, serviceId } = data;

    if (!startTime && !serviceId) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    let endTime;

    // If startTime or serviceId is updated, recalculate endTime
    if (startTime || serviceId) {
      const booking = await prisma.booking.findUnique({
        where: { id },
        include: { service: true },
      });

      const serviceToUse = serviceId
        ? await prisma.service.findUnique({ where: { id: serviceId } })
        : booking.service;

      const start = startTime ? new Date(startTime) : new Date(booking.startTime);
      endTime = new Date(start.getTime() + serviceToUse.duration * 60000);
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        startTime: startTime ? new Date(startTime) : undefined,
        endTime,
        serviceId,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating booking:', error);
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 });
  }
}


export async function DELETE(request, context) {
  try {
    const { id } = context.params;
    const role = request.headers.get('x-user-role');
    const userId = request.headers.get('x-user-id');

    if (role !== 'STAFF') {
      return NextResponse.json({ error: 'Forbidden: Staff only' }, { status: 403 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { business: { include: { staff: true } } },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const isStaffOfBusiness = booking.business.staff.some(staff => staff.id === userId);

    if (!isStaffOfBusiness) {
      return NextResponse.json({ error: 'Forbidden: Not authorized for this booking' }, { status: 403 });
    }

    await prisma.booking.delete({ where: { id } });

    return NextResponse.json({ message: 'Booking deleted' });
  } catch (error) {
    console.error('Error deleting booking:', error);
    return NextResponse.json({ error: 'Failed to delete booking' }, { status: 500 });
  }
}
