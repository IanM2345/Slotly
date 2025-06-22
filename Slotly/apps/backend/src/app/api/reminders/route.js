import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const { bookingId, sendAt, method } = await request.json();

    if (!bookingId || !sendAt || !method) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const existing = await prisma.reminder.findUnique({ where: { bookingId } });
    if (existing) {
      return NextResponse.json({ error: 'Reminder already exists for this booking' }, { status: 409 });
    }

    const reminder = await prisma.reminder.create({
      data: {
        bookingId,
        sendAt: new Date(sendAt),
        method,
      },
    });

    return NextResponse.json(reminder, { status: 201 });
  } catch (error) {
    console.error('Error creating reminder:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sent = searchParams.get('sent');
    const bookingId = searchParams.get('bookingId');

    const filters = {};
    if (sent !== null) filters.sent = sent === 'true';
    if (bookingId) filters.bookingId = bookingId;

    const reminders = await prisma.reminder.findMany({
      where: filters,
      include: {
        booking: {
          include: {
            user: true,
            service: true,
            business: true,
          },
        },
      },
      orderBy: { sendAt: 'asc' },
    });

    return NextResponse.json(reminders, { status: 200 });
  } catch (error) {
    console.error('Error fetching reminders:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
