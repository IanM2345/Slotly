// File: apps/backend/src/app/api/staff/notifications/route.js
// Staff notifications endpoint

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
    const unreadOnly = url.searchParams.get('unread') === 'true';
    const type = url.searchParams.get('type'); // Filter by notification type
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const where = { userId: ctx.userId };
    if (unreadOnly) {
      where.read = false;
    }
    if (type) {
      where.type = type.toUpperCase();
    }

    const [notifications, totalCount, unreadCount, typeBreakdown] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ 
        where: { userId: ctx.userId, read: false } 
      }),
      prisma.notification.groupBy({
        by: ['type'],
        where: { userId: ctx.userId },
        _count: { type: true },
        orderBy: { _count: { type: 'desc' } }
      })
    ]);

    // Format type breakdown for easier consumption
    const typeStats = typeBreakdown.reduce((acc, item) => {
      acc[item.type] = item._count.type;
      return acc;
    }, {});

    return NextResponse.json({
      notifications: notifications || [],
      stats: {
        total: totalCount || 0,
        unread: unreadCount || 0,
        loaded: notifications.length,
        byType: typeStats
      },
      pagination: {
        limit,
        offset,
        hasMore: offset + notifications.length < totalCount
      }
    });
  } catch (err) {
    Sentry.captureException?.(err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Mark notifications as read
export async function PUT(request) {
  try {
    const ctx = await getStaffContext(request);
    if (ctx?.error) return ctx.response;

    const body = await request.json().catch(() => ({}));
    const { notificationIds, markAllAsRead } = body;

    if (markAllAsRead) {
      const updated = await prisma.notification.updateMany({
        where: { userId: ctx.userId, read: false },
        data: { read: true }
      });
      return NextResponse.json({ ok: true, updated: updated.count });
    }

    if (!Array.isArray(notificationIds) || !notificationIds.length) {
      return NextResponse.json({ 
        error: 'Provide notificationIds array or set markAllAsRead: true' 
      }, { status: 400 });
    }

    const updated = await prisma.notification.updateMany({
      where: { 
        id: { in: notificationIds }, 
        userId: ctx.userId 
      },
      data: { read: true }
    });

    return NextResponse.json({ ok: true, updated: updated.count });
  } catch (err) {
    Sentry.captureException?.(err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Delete notifications
export async function DELETE(request) {
  try {
    const ctx = await getStaffContext(request);
    if (ctx?.error) return ctx.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const deleteAll = searchParams.get('all') === 'true';

    if (deleteAll) {
      const deleted = await prisma.notification.deleteMany({
        where: { userId: ctx.userId, read: true } // Only delete read notifications
      });
      return NextResponse.json({ ok: true, deleted: deleted.count });
    }

    if (!id) {
      return NextResponse.json({ 
        error: 'Provide notification id or set ?all=true to delete read notifications' 
      }, { status: 400 });
    }

    const deleted = await prisma.notification.deleteMany({
      where: { id, userId: ctx.userId }
    });

    if (!deleted.count) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, deleted: deleted.count });
  } catch (err) {
    Sentry.captureException?.(err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}