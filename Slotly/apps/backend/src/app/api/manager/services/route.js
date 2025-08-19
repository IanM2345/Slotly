
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';
import { serviceLimitByPlan } from '@/shared/subscriptionPlanUtils';
import { createNotification } from '@/shared/notifications/createNotification';



const prisma = new PrismaClient();

async function getBusinessFromRequest(request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { error: 'Unauthorized', status: 401 };
    }

    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);
    if (!valid || decoded.role !== 'BUSINESS_OWNER') {
      return { error: 'Unauthorized', status: 403 };
    }

    const business = await prisma.business.findFirst({
      where: { ownerId: decoded.userId },
    });

    if (!business) return { error: 'Business not found', status: 404 };

    Sentry.setUser({ id: decoded.userId, role: decoded.role });
    return { business };
  } catch (err) {
    Sentry.captureException(err);
    return { error: 'Token validation error', status: 500 };
  }
}

export async function POST(request) {
  try {
    const { business, error, status } = await getBusinessFromRequest(request);
    if (error) return NextResponse.json({ error }, { status });

    const { name, price, duration, category, available = true } = await request.json();

    if (!name || !price || !duration) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

   
    const limit = serviceLimitByPlan[business.plan];
    const currentCount = await prisma.service.count({
      where: { businessId: business.id },
    });

    if (currentCount >= limit) {
     
      await createNotification({
        userId: business.ownerId,
        type: 'SYSTEM',
        title: 'Service Limit Reached',
        message: `Your plan allows a maximum of ${limit} services. Upgrade your subscription or purchase a Service Add-on to create more.`,
      });

      
      Sentry.captureMessage(`Service limit reached for business ${business.id} (Plan: ${business.plan}, Limit: ${limit})`);

     
      return NextResponse.json(
        {
          error: `Service limit reached (${limit}) for your current plan.`,
          suggestion: 'Please upgrade your subscription or purchase an add-on to add more services.',
        },
        { status: 403 }
      );
    }

    const newService = await prisma.service.create({
      data: {
        name,
        price: parseInt(price),
        duration: parseInt(duration),
        category,
        available,
        businessId: business.id,
      },
    });

    return NextResponse.json(newService, { status: 201 });

  } catch (error) {
    Sentry.captureException(error);
    console.error('Error creating service:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { business, error, status } = await getBusinessFromRequest(request);
    if (error) return NextResponse.json({ error }, { status });

    const { id, name, price, duration, category, available } = await request.json();
    if (!id) return NextResponse.json({ error: 'Service ID is required' }, { status: 400 });

    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing || existing.businessId !== business.id) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    const updated = await prisma.service.update({
      where: { id },
      data: {
        name,
        price: price ? parseInt(price) : undefined,
        duration: duration ? parseInt(duration) : undefined,
        category,
        available,
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error updating service:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { business, error, status } = await getBusinessFromRequest(request);
    if (error) return NextResponse.json({ error }, { status });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Service ID is required' }, { status: 400 });

    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing || existing.businessId !== business.id) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    await prisma.service.delete({ where: { id } });
    return NextResponse.json({ message: 'Service deleted' }, { status: 200 });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error deleting service:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { business, error, status } = await getBusinessFromRequest(request);
    if (error) return NextResponse.json({ error }, { status });

    const { id, available } = await request.json();
    if (!id || typeof available !== 'boolean') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing || existing.businessId !== business.id) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    const updated = await prisma.service.update({
      where: { id },
      data: { available },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error toggling service availability:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { business, error, status } = await getBusinessFromRequest(request);
    if (error) return NextResponse.json({ error }, { status });

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category")?.toLowerCase() || undefined;

    const where = { businessId: business.id };
    if (category) where.category = category;

    const rows = await prisma.service.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        serviceStaff: {
          include: { staff: { select: { id: true, name: true } } },
        },
      },
    });

    // 🔧 Shape to what the app expects: staff: [{id,name}]
    const services = rows.map(s => ({
      id: s.id,
      name: s.name,
      price: s.price,
      duration: s.duration,
      category: s.category,
      available: s.available,
      businessId: s.businessId,
      createdAt: s.createdAt,
      staff: s.serviceStaff.map(a => ({ id: a.staff.id, name: a.staff.name })),
    }));

    return NextResponse.json({ services }, { status: 200 });
  } catch (e) {
    Sentry.captureException(e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
