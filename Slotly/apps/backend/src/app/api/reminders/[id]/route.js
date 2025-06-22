import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

export async function GET(request, { params }) {
  try {
    const { id } = params;

    const reminder = await prisma.reminder.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            user: true,
            service: true,
            business: true,
          },
        },
      },
    });

    if (!reminder) {
      return NextResponse.json({ error: 'Reminder not found' }, { status: 404 });
    }

    return NextResponse.json(reminder, { status: 200 });
  } catch (error) {
    console.error('Error fetching reminder:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const { sendAt, method, sent } = await request.json();

    const reminder = await prisma.reminder.update({
      where: { id },
      data: {
        sendAt: sendAt ? new Date(sendAt) : undefined,
        method,
        sent,
      },
    });

    return NextResponse.json(reminder, { status: 200 });
  } catch (error) {
    console.error('Error updating reminder:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;

    await prisma.reminder.delete({ where: { id } });

    return NextResponse.json({ message: 'Reminder deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting reminder:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
