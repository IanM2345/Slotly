// apps/backend/src/app/api/services/[id]/route.js
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';

const prisma = globalThis._prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalThis._prisma = prisma;

export const dynamic = 'force-dynamic';

// GET endpoint - Public access (no auth required)
export async function GET(_req, ctx) {
  try {
    const { id } = await (ctx?.params ?? {});
    if (!id) {
      return NextResponse.json({ error: 'Missing service ID' }, { status: 400 });
    }

    let service;

    // Handle synthetic service IDs like "businessId-svc-0"
    if (id.includes('-svc-')) {
      const businessId = id.split('-svc-')[0];
      const serviceIndex = parseInt(id.split('-svc-')[1] || '0', 10);
      
      console.log(`Resolving synthetic service ID: ${id} -> businessId: ${businessId}, index: ${serviceIndex}`);
      
      // Get all services for this business, ordered consistently
      const services = await prisma.service.findMany({
        where: { businessId },
        include: {
          business: {
            select: {
              id: true,
              name: true,
              address: true,
              latitude: true,
              longitude: true,
              logoUrl: true,
            },
          },
        },
        orderBy: [
          { createdAt: 'asc' },
          { id: 'asc' }
        ],
      });

      if (services.length === 0) {
        return NextResponse.json(
          { error: 'No services found for this business' },
          { status: 404 }
        );
      }

      // Select service by index, defaulting to first service
      service = services[serviceIndex] || services[0];
      
      if (!service) {
        return NextResponse.json(
          { error: 'Service not found at specified index' },
          { status: 404 }
        );
      }
      
      console.log(`Resolved synthetic ID ${id} to real service ID: ${service.id}`);
    } else {
      // Handle real service IDs
      service = await prisma.service.findUnique({
        where: { id: String(id) },
        include: {
          business: {
            select: {
              id: true,
              name: true,
              address: true,
              latitude: true,
              longitude: true,
              logoUrl: true,
            },
          },
        },
      });

      if (!service) {
        return NextResponse.json(
          { error: 'Service not found' },
          { status: 404 }
        );
      }
    }

    // Shape the response consistently
    const result = {
      id: service.id, // Always return the REAL service ID
      name: service.name,
      description: service.description ?? null,
      duration: service.duration ?? null,
      price: service.price ?? null,
      imageUrl: service.imageUrl ?? null,
      business: service.business,
      // Include metadata for debugging
      _meta: {
        originalRequestId: id,
        wasSynthetic: id.includes('-svc-'),
        resolvedFromBusinessId: id.includes('-svc-') ? id.split('-svc-')[0] : null,
      },
    };

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    Sentry.captureException(err);
    console.error('Error fetching service:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request, ctx) {
  try {
    const { id: serviceId } = await (ctx?.params ?? {});
    
    // Don't allow PUT operations on synthetic IDs
    if (serviceId?.includes('-svc-')) {
      return NextResponse.json(
        { error: 'Cannot update using synthetic service ID' },
        { status: 400 }
      );
    }

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

export async function DELETE(request, ctx) {
  try {
    const { id: serviceId } = await (ctx?.params ?? {});
    
    // Don't allow DELETE operations on synthetic IDs
    if (serviceId?.includes('-svc-')) {
      return NextResponse.json(
        { error: 'Cannot delete using synthetic service ID' },
        { status: 400 }
      );
    }

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