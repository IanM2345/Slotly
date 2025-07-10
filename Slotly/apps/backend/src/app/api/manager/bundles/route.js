import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';

const prisma = new PrismaClient();


async function getBusinessFromToken(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
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

  if (!business) {
    return { error: 'Business not found' }, { status: 404 };
  }

  return { business };
}


export async function POST(request) {
  try {
    const { business, error, status } = await getBusinessFromToken(request);
    if (error) return NextResponse.json({ error }, { status });

    const body = await request.json();
    const { name, description, price, duration, serviceIds } = body;

    if (!name || !price || !duration || !Array.isArray(serviceIds) || serviceIds.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const bundle = await prisma.serviceBundle.create({
      data: {
        name,
        description,
        price,
        duration,
        businessId: business.id,
        services: {
          create: serviceIds.map((id, index) => ({
            service: { connect: { id } },
            position: index + 1,
          })),
        },
      },
      include: {
        services: {
          include: {
            service: true,
          },
        },
      },
    });

    return NextResponse.json(bundle, { status: 201 });
  } catch (err) {
    console.error('POST /manager/bundles error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}


export async function GET(request) {
  try {
    const { business, error, status } = await getBusinessFromToken(request);
    if (error) return NextResponse.json({ error }, { status });

    const bundles = await prisma.serviceBundle.findMany({
      where: { businessId: business.id },
      include: {
        services: {
          include: {
            service: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ bundles }, { status: 200 });
  } catch (err) {
    console.error('GET /manager/bundles error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}


export async function DELETE(request) {
  try {
    const { business, error, status } = await getBusinessFromToken(request);
    if (error) return NextResponse.json({ error }, { status });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Bundle ID is required' }, { status: 400 });
    }

    
    const bundle = await prisma.serviceBundle.findFirst({
      where: {
        id,
        businessId: business.id,
      },
      include: {
        services: true,
      },
    });

    if (!bundle) {
      return NextResponse.json({ error: 'Bundle not found' }, { status: 404 });
    }

    
    await prisma.serviceBundle.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Bundle deleted successfully' }, { status: 200 });
  } catch (err) {
    console.error('DELETE /manager/bundles error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
