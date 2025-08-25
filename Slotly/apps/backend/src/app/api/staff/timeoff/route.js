// File: apps/backend/src/app/api/staff/timeoff/route.js
// Staff time-off request management endpoint

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
    const status = url.searchParams.get('status');
    const upcoming = url.searchParams.get('upcoming') === 'true';

    const where = {
      staffId: ctx.userId,
      businessId: ctx.business.id,
    };

    if (status) {
      where.status = status.toUpperCase();
    }

    if (upcoming) {
      where.startDate = { gte: new Date() };
    }

    const rows = await prisma.timeOffRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        reason: true,
        status: true,
        createdAt: true,
        reviewedAt: true
      }
    });

    // Calculate statistics
    const stats = {
      pending: rows.filter(r => r.status === 'PENDING').length,
      approved: rows.filter(r => r.status === 'APPROVED').length,
      rejected: rows.filter(r => r.status === 'REJECTED').length,
      total: rows.length
    };

    return NextResponse.json({ 
      requests: rows || [],
      stats,
      business: ctx.business
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

    const payload = await request.json().catch(() => ({}));
    const { startDate, endDate, reason } = payload || {};
    
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Validate dates
    if (start >= end) {
      return NextResponse.json(
        { error: 'Start date must be before end date' },
        { status: 400 }
      );
    }

    // Check for overlapping requests
    const overlapping = await prisma.timeOffRequest.findFirst({
      where: {
        staffId: ctx.userId,
        businessId: ctx.business.id,
        status: { in: ['PENDING', 'APPROVED'] },
        OR: [
          { startDate: { lte: end }, endDate: { gte: start } }
        ]
      }
    });

    if (overlapping) {
      return NextResponse.json({
        error: 'You already have a time-off request for this period',
        existingRequest: {
          id: overlapping.id,
          startDate: overlapping.startDate,
          endDate: overlapping.endDate,
          status: overlapping.status
        }
      }, { status: 400 });
    }

    const row = await prisma.timeOffRequest.create({
      data: {
        staffId: ctx.userId,
        businessId: ctx.business.id,
        startDate: start,
        endDate: end,
        reason: reason || null,
        status: 'PENDING',
      },
    });

    // Create notification for business owner
    try {
      const business = await prisma.business.findUnique({
        where: { id: ctx.business.id },
        select: { ownerId: true, name: true }
      });

      if (business?.ownerId) {
        await prisma.notification.create({
          data: {
            userId: business.ownerId,
            type: 'TIME_OFF',
            title: 'New Staff Time Off Request',
            message: `A staff member at ${business.name} requested time off from ${startDate} to ${endDate}.`,
          }
        });
      }
    } catch (notificationError) {
      console.warn('Failed to create notification:', notificationError);
    }

    return NextResponse.json(row, { status: 201 });
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

    const payload = await request.json().catch(() => ({}));
    const { startDate, endDate, reason } = payload;

    // Only allow updates to pending requests
    const existing = await prisma.timeOffRequest.findFirst({
      where: {
        id,
        staffId: ctx.userId,
        businessId: ctx.business.id,
        status: 'PENDING'
      }
    });

    if (!existing) {
      return NextResponse.json({ 
        error: 'Request not found or cannot be modified' 
      }, { status: 404 });
    }

    const updateData = {};
    if (startDate) updateData.startDate = new Date(startDate);
    if (endDate) updateData.endDate = new Date(endDate);
    if (reason !== undefined) updateData.reason = reason;

    const updated = await prisma.timeOffRequest.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json(updated);
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

    const res = await prisma.timeOffRequest.updateMany({
      where: { 
        id, 
        staffId: ctx.userId, 
        businessId: ctx.business.id, 
        status: 'PENDING' 
      },
      data: { status: 'REJECTED' },
    });

    if (!res.count) {
      return NextResponse.json({ 
        error: 'Request not found or already processed' 
      }, { status: 404 });
    }
    
    return NextResponse.json({ ok: true, canceled: res.count });
  } catch (err) {
    Sentry.captureException?.(err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}