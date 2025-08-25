// File: apps/backend/src/app/api/staff/availability/route.js
// Staff availability management endpoint

import * as Sentry from '@sentry/nextjs';
import { PrismaClient } from '@/generated/prisma';
import { NextResponse } from 'next/server';
import { getStaffContext } from '../route';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const ctx = await getStaffContext(request);
    if (ctx?.error) return ctx.response;

    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    const where = {
      staffId: ctx.userId,
      businessId: ctx.business.id,
    };

    // Add date filters if provided
    if (startDate) {
      where.startTime = { gte: new Date(startDate) };
    }
    if (endDate) {
      where.endTime = { lte: new Date(endDate) };
    }

    const rows = await prisma.availability.findMany({
      where,
      orderBy: { startTime: 'asc' },
    });

    return NextResponse.json({ 
      availability: rows || [],
      business: ctx.business,
      total: rows?.length || 0
    });
  } catch (err) {
    Sentry.captureException?.(err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const ctx = await getStaffContext(request);
    if (ctx?.error) return ctx.response;

    const body = await request.json().catch(() => ({}));
    const slots = Array.isArray(body?.slots) ? body.slots : [body];

    // Normalize + validate
    const data = (slots || [])
      .filter((s) => s && s.startTime && s.endTime)
      .map((s) => ({
        staffId: ctx.userId,
        businessId: ctx.business.id,
        startTime: new Date(s.startTime),
        endTime: new Date(s.endTime),
      }));

    if (!data.length) {
      return NextResponse.json(
        { error: 'Provide startTime and endTime (or slots[] of them)' },
        { status: 400 }
      );
    }

    // Validate each slot
    for (const slot of data) {
      if (slot.startTime >= slot.endTime) {
        return NextResponse.json(
          { error: 'Start time must be before end time' },
          { status: 400 }
        );
      }
    }

    // Check for overlapping approved time-off requests
    const start = new Date(Math.min(...data.map(d => d.startTime)));
    const end = new Date(Math.max(...data.map(d => d.endTime)));
    
    const overlappingTimeOff = await prisma.timeOffRequest.findFirst({
      where: {
        staffId: ctx.userId,
        businessId: ctx.business.id,
        status: 'APPROVED',
        startDate: { lte: end },
        endDate: { gte: start }
      }
    });

    if (overlappingTimeOff) {
      return NextResponse.json({
        error: 'This availability overlaps with an approved time-off request',
        conflictingRequest: {
          id: overlappingTimeOff.id,
          startDate: overlappingTimeOff.startDate,
          endDate: overlappingTimeOff.endDate,
          reason: overlappingTimeOff.reason
        }
      }, { status: 400 });
    }

    const created = await prisma.availability.createMany({ 
      data, 
      skipDuplicates: true 
    });

    return NextResponse.json({ 
      ok: true, 
      created: created.count,
      business: ctx.business
    }, { status: 201 });
  } catch (err) {
    Sentry.captureException?.(err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const ctx = await getStaffContext(request);
    if (ctx?.error) return ctx.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const { startTime, endTime } = body;

    if (!startTime || !endTime) {
      return NextResponse.json(
        { error: 'startTime and endTime are required' },
        { status: 400 }
      );
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (start >= end) {
      return NextResponse.json(
        { error: 'Start time must be before end time' },
        { status: 400 }
      );
    }

    const updated = await prisma.availability.updateMany({
      where: { id, staffId: ctx.userId, businessId: ctx.business.id },
      data: { startTime: start, endTime: end }
    });

    if (!updated.count) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException?.(err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const ctx = await getStaffContext(request);
    if (ctx?.error) return ctx.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const res = await prisma.availability.deleteMany({
      where: { id, staffId: ctx.userId, businessId: ctx.business.id },
    });

    if (!res.count) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, deleted: res.count });
  } catch (err) {
    Sentry.captureException?.(err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}