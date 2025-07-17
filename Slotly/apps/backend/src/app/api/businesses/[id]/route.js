import '@/sentry.server.config'
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server'; 
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();


export async function PUT(request, { params }) {
  try {
    const businessId = params.id;
    const data = await request.json();
    const { name, description } = data;

    const updatedBusiness = await prisma.business.update({
      where: { id: businessId },
      data: { name, description },
    });

    return NextResponse.json(updatedBusiness);
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error updating business:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}


export async function DELETE(request, { params }) {
  try {
    const businessId = params.id;

    await prisma.business.delete({
      where: { id: businessId },
    });

    return NextResponse.json({ message: 'Business deleted successfully' });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error deleting business:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
