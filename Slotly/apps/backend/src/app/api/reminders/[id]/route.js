
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

export async function GET(request, { params }) {
  try {
    const { id } = params;
    if (!id) return NextResponse.json({ error: 'Reminder ID required' }, { status: 400 });

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
    Sentry.captureException?.(error);
    console.error('Error fetching reminder:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    if (!id) return NextResponse.json({ error: 'Reminder ID required' }, { status: 400 });

    const { sendAt, method, sent } = await request.json();
    const data = {};
    if (sendAt) data.sendAt = new Date(sendAt);
    if (method !== undefined) data.method = method;
    if (sent !== undefined) data.sent = sent;

    const reminder = await prisma.reminder.update({
      where: { id },
      data,
    });

    return NextResponse.json(reminder, { status: 200 });
  } catch (error) {
    Sentry.captureException?.(error);
    console.error('Error updating reminder:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    if (!id) return NextResponse.json({ error: 'Reminder ID required' }, { status: 400 });

    await prisma.reminder.delete({ where: { id } });

    return NextResponse.json({ message: 'Reminder deleted successfully' }, { status: 200 });
  } catch (error) {
    Sentry.captureException?.(error);
    console.error('Error deleting reminder:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
