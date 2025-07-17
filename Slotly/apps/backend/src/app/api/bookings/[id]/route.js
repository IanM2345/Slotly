import '@/sentry.server.config'
import * as Sentry from '@sentry/nextjs'; 
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/lib/auth'; 

const prisma = new PrismaClient();

export async function PUT(request, { params }) {
  const { valid, decoded, error } = await verifyToken(request);
  if (!valid) return NextResponse.json({ error }, { status: 401 });
  if (decoded.role !== 'STAFF') return NextResponse.json({ error: 'Only staff can update bookings' }, { status: 403 });

  try {
    const { id } = params;
    const { startTime, serviceId } = await request.json();

    if (!startTime && !serviceId) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { business: { include: { staff: true } }, service: true },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const staffList = booking.business?.staff ?? [];
    const isStaff = staffList.some(staff => staff.id === decoded.id);
    if (!isStaff) return NextResponse.json({ error: 'Not authorized for this booking' }, { status: 403 });

    const service = serviceId
      ? await prisma.service.findUnique({ where: { id: serviceId } })
      : booking.service;

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    const start = startTime ? new Date(startTime) : new Date(booking.startTime);
    const endTime = new Date(start.getTime() + service.duration * 60000);

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        startTime: startTime ? new Date(startTime) : undefined,
        endTime,
        serviceId: serviceId ? serviceId : undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    Sentry.captureException(error); 
    console.error('Error updating booking:', error);
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { valid, decoded, error } = await verifyToken(request);
  if (!valid) return NextResponse.json({ error }, { status: 401 });
  if (decoded.role !== 'STAFF') return NextResponse.json({ error: 'Only staff can delete bookings' }, { status: 403 });

  try {
    const { id } = params;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { business: { include: { staff: true } } },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const staffList = booking.business?.staff ?? [];
    const isStaff = staffList.some(staff => staff.id === decoded.id);
    if (!isStaff) return NextResponse.json({ error: 'Not authorized for this booking' }, { status: 403 });

    await prisma.booking.delete({ where: { id } });

    return NextResponse.json({ message: 'Booking deleted' });
  } catch (error) {
    Sentry.captureException(error); 
    console.error('Error deleting booking:', error);
    return NextResponse.json({ error: 'Failed to delete booking' }, { status: 500 });
  }
}
