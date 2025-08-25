import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { PrismaClient } from '@/generated/prisma';
import { verifyToken } from '@/middleware/auth';
import { getPlanFeatures } from '@/shared/subscriptionPlanUtils';
import { Parser } from 'json2csv'; 

const prisma = new PrismaClient();
const inMemoryCache = new Map();
const cacheTTL = 1000 * 60 * 5;

function groupByUnit(date, view) {
  const d = new Date(date);
  switch (view) {
    case 'daily':
      return d.toISOString().slice(0, 10);
    case 'weekly': {
      const start = new Date(d.setDate(d.getDate() - d.getDay()));
      return start.toISOString().slice(0, 10);
    }
    case 'monthly':
    default:
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
}

function rollingAverage(data, window = 7) {
  const keys = Object.keys(data).sort();
  const result = {};
  for (let i = 0; i < keys.length; i++) {
    const slice = keys.slice(Math.max(0, i - window + 1), i + 1);
    const avg = slice.reduce((sum, key) => sum + data[key], 0) / slice.length;
    result[keys[i]] = avg;
  }
  return result;
}

async function getBusinessFromToken(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Unauthorized', status: 401 };
  }
  const token = authHeader.split(' ')[1];
  const { valid, decoded } = await verifyToken(token);
  if (!valid || decoded.role !== 'BUSINESS_OWNER') {
    return { error: 'Forbidden', status: 403 };
  }
  const business = await prisma.business.findFirst({
    where: { ownerId: decoded.userId },
  });
  if (!business) {
    return { error: 'Business not found', status: 404 };
  }
  return { business, userId: decoded.userId };
}

export async function GET(request) {
  try {
    const { business, error, status } = await getBusinessFromToken(request);
    if (error) return NextResponse.json({ error }, { status });

    const features = getPlanFeatures(business.plan);
    if (!features.canUseAnalytics) {
      return NextResponse.json(
        {
          error: 'Your subscription does not support analytics access.',
          details: {
            error: 'Your subscription does not support analytics access.',
            suggestion: 'Upgrade your plan to unlock analytics.',
          },
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    // Support both legacy (view/startDate/endDate) and new (period/tz)
    const period = searchParams.get('period'); // "7d" | "30d" | "90d"
    const tz = searchParams.get('tz') || 'Africa/Nairobi';

    let view = searchParams.get('view') || 'monthly';
    let startDateParam = searchParams.get('startDate');
    let endDateParam = searchParams.get('endDate');

    const now = new Date();
    let startDate = startDateParam ? new Date(startDateParam) : new Date(new Date().getFullYear(), 0, 1);
    let endDate = endDateParam ? new Date(endDateParam) : now;

    if (period) {
      // Map period → view + rolling window
      const map = { '7d': { days: 7, view: 'daily' }, '30d': { days: 30, view: 'weekly' }, '90d': { days: 90, view: 'monthly' } };
      const cfg = map[period] || map['30d'];
      view = cfg.view;
      endDate = now;
      startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - (cfg.days - 1));
    }

    if (isNaN(startDate) || isNaN(endDate)) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    const metrics = (searchParams.get('metrics') || 'bookings,revenue,clients,services,staffPerformance,noShows').split(',');
    const smoothing = searchParams.get('smoothing') === 'true'; // for rolling average
    const abTestGroup = searchParams.get('abGroup');
    const staffLimit = parseInt(searchParams.get('staffLimit')) || 5;
    const exportCsv = searchParams.get('export') === 'csv';

    const cacheKey = `${business.id}:${view}:${startDate.toISOString()}:${endDate.toISOString()}:${metrics.sort().join(',')}:${smoothing}:${abTestGroup}:${staffLimit}:${period || ''}:${tz}`;
    const cached = inMemoryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cacheTTL) {
      if (exportCsv) {
        const parser = new Parser();
        const csv = parser.parse(cached.data.analytics);
        return new NextResponse(csv, {
          headers: { 'Content-Type': 'text/csv' },
          status: 200,
        });
      }
      return NextResponse.json(cached.data, { status: 200 });
    }

    const analytics = {};
    const nowNow = new Date(); // avoid shadowing "now" if used above

    if (metrics.includes('bookings')) {
      const bookings = await prisma.booking.findMany({
        where: {
          businessId: business.id,
          startTime: { gte: startDate, lte: endDate < nowNow ? endDate : nowNow },
        },
        select: { startTime: true },
      });
      const grouped = bookings.reduce((acc, item) => {
        const key = groupByUnit(item.startTime, view);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      analytics.bookings = grouped;
      if (smoothing) {
        analytics.bookingsSmoothed = rollingAverage(grouped, 7);
      }
    }

    if (metrics.includes('revenue')) {
      const payments = await prisma.payment.findMany({
        where: {
          businessId: business.id,
          status: 'SUCCESS',
          createdAt: { gte: startDate, lte: endDate },
        },
        select: { amount: true, createdAt: true },
      });
      const grouped = payments.reduce((acc, item) => {
        const key = groupByUnit(item.createdAt, view);
        acc[key] = (acc[key] || 0) + item.amount;
        return acc;
      }, {});
      analytics.revenue = grouped;
      if (smoothing) {
        analytics.revenueSmoothed = rollingAverage(grouped, 7);
      }
    }

    if (metrics.includes('clients')) {
      const clients = await prisma.booking.findMany({
        where: {
          businessId: business.id,
          startTime: { gte: startDate, lte: endDate },
        },
        select: { userId: true },
        distinct: ['userId'],
      });
      analytics.clients = clients.length;
    }

    if (metrics.includes('services')) {
      const serviceBookings = await prisma.booking.groupBy({
        by: ['serviceId'],
        where: {
          businessId: business.id,
          startTime: { gte: startDate, lte: endDate },
        },
        _count: true,
        orderBy: {
          _count: { serviceId: 'desc' },
        },
        take: 5,
      });

      const serviceIds = serviceBookings.map((s) => s.serviceId);
      const serviceNames = await prisma.service.findMany({
        where: { id: { in: serviceIds } },
        select: { id: true, name: true },
      });

      analytics.popularServices = serviceBookings.map((entry) => ({
        serviceId: entry.serviceId,
        count: entry._count,
        name: serviceNames.find((s) => s.id === entry.serviceId)?.name || 'Unknown',
      }));
    }

    if (metrics.includes('noShows')) {
      const noShows = await prisma.booking.findMany({
        where: {
          businessId: business.id,
          status: 'CONFIRMED',
          startTime: { gte: startDate, lte: endDate < nowNow ? endDate : nowNow },
        },
        select: { startTime: true },
      });

      const grouped = noShows.reduce((acc, item) => {
        const key = groupByUnit(item.startTime, view);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      analytics.noShows = grouped;
      if (smoothing) {
        analytics.noShowsSmoothed = rollingAverage(grouped, 7);
      }
    }

    if (metrics.includes('staffPerformance')) {
      const [completed, cancelled, noShows] = await Promise.all([
        prisma.booking.groupBy({
          by: ['staffId'],
          where: {
            businessId: business.id,
            staffId: { not: null },
            status: 'COMPLETED',
            startTime: { gte: startDate, lte: endDate },
          },
          _count: true,
        }),
        prisma.booking.groupBy({
          by: ['staffId'],
          where: {
            businessId: business.id,
            staffId: { not: null },
            status: 'CANCELLED',
            startTime: { gte: startDate, lte: endDate },
          },
          _count: true,
        }),
        prisma.booking.groupBy({
          by: ['staffId'],
          where: {
            businessId: business.id,
            staffId: { not: null },
            status: 'CONFIRMED',
            startTime: { gte: startDate, lte: endDate < nowNow ? endDate : nowNow },
          },
          _count: true,
        }),
      ]);

      const staffMap = {};
      completed.forEach(({ staffId, _count }) => {
        staffMap[staffId] = { staffId, completed: _count, cancelled: 0, noShows: 0 };
      });
      cancelled.forEach(({ staffId, _count }) => {
        staffMap[staffId] = staffMap[staffId] || { staffId, completed: 0, cancelled: 0, noShows: 0 };
        staffMap[staffId].cancelled = _count;
      });
      noShows.forEach(({ staffId, _count }) => {
        staffMap[staffId] = staffMap[staffId] || { staffId, completed: 0, cancelled: 0, noShows: 0 };
        staffMap[staffId].noShows = _count;
      });

      const allStaffIds = Object.keys(staffMap);
      const staffDetails = await prisma.user.findMany({
        where: { id: { in: allStaffIds } },
        select: { id: true, name: true },
      });

      const performanceList = allStaffIds.map((staffId) => {
        const entry = staffMap[staffId];
        const total = entry.completed + entry.cancelled + entry.noShows;
        const score = total > 0 ? Math.round((entry.completed / total) * 100) : 0;
        return {
          staffId,
          name: staffDetails.find((s) => s.id === staffId)?.name || 'Unknown',
          completed: entry.completed,
          cancelled: entry.cancelled,
          noShows: entry.noShows,
          performanceScore: score,
        };
      });

      const sorted = [...performanceList].sort((a, b) => b.performanceScore - a.performanceScore);
      const count = sorted.length;
      const cutoffGood = Math.floor(count * 0.25);
      const cutoffPoor = Math.floor(count * 0.75);

      const colorCoded = sorted.map((entry, i) => ({
        ...entry,
        performanceLevel:
          i < cutoffGood ? 'good' : i >= cutoffPoor ? 'poor' : 'average',
      }));

      analytics.staffPerformance = colorCoded.slice(0, staffLimit);
    }

    if (metrics.includes('dropOff')) {
      const dropOffs = await prisma.booking.findMany({
        where: {
          businessId: business.id,
          status: 'CANCELLED',
          startTime: { gte: startDate, lte: endDate },
        },
        select: { startTime: true },
      });
      const grouped = dropOffs.reduce((acc, item) => {
        const key = groupByUnit(item.startTime, view);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      analytics.dropOffs = grouped;
      if (smoothing) {
        analytics.dropOffsSmoothed = rollingAverage(grouped, 7);
      }
    }

    if (metrics.includes('abTest') && abTestGroup) {
      const bookings = await prisma.booking.findMany({
        where: {
          businessId: business.id,
          abTestGroup: abTestGroup,
          startTime: { gte: startDate, lte: endDate },
        },
        select: { startTime: true },
      });
      const grouped = bookings.reduce((acc, item) => {
        const key = groupByUnit(item.startTime, view);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      analytics[`bookings_ab_${abTestGroup}`] = grouped;
    }

    const responseData = {
      analytics,
      meta: { startDate, endDate, view, cached: false },
    };

    inMemoryCache.set(cacheKey, { data: responseData, timestamp: Date.now() });

    // ---- Build forward‑compat "kpis" + "series" from analytics ----
    // bookings/revenue keyed buckets → totals
    const sumDict = (d) => Object.values(d || {}).reduce((s, v) => s + (Number.isFinite(+v) ? +v : 0), 0);

    // Compute totals for KPIs (use what we already queried)
    const kBookings = sumDict(analytics.bookings);
    const kRevenue = sumDict(analytics.revenue);

    // Cancellations total in window
    let kCancellations = 0;
    try {
      kCancellations = await prisma.booking.count({
        where: { businessId: business.id, status: 'CANCELLED', startTime: { gte: startDate, lte: endDate } },
      });
    } catch {}

    // No-shows total (derived if present)
    const kNoShows = sumDict(analytics.noShows);
    const kAvgTicket = kBookings > 0 ? Math.round(kRevenue / kBookings) : 0;

    // byDay series (normalize date key as returned by groupByUnit)
    const byDay = [];
    const allKeys = new Set([
      ...Object.keys(analytics.bookings || {}),
      ...Object.keys(analytics.revenue || {}),
    ]);
    Array.from(allKeys).sort().forEach((key) => {
      byDay.push({
        date: key,
        bookings: Number.isFinite(+analytics.bookings?.[key]) ? +analytics.bookings[key] : 0,
        revenue: Number.isFinite(+analytics.revenue?.[key]) ? +analytics.revenue[key] : 0,
      });
    });

    // byService series from popularServices (revenue not computed here, default 0)
    const byService = (analytics.popularServices || []).map((s) => ({
      serviceId: s.serviceId || null,
      name: s.name || 'Unknown',
      count: Number.isFinite(+s.count) ? +s.count : 0,
      revenue: 0,
    }));

    const compatPayload = {
      ...responseData,
      kpis: { bookings: kBookings, revenue: kRevenue, cancellations: kCancellations, noShows: kNoShows, avgTicket: kAvgTicket },
      series: { byDay, byService },
      tz, period: period || null, // echo back for clients
    };

    if (exportCsv) {
      const parser = new Parser();
      const csv = parser.parse(analytics);
      return new NextResponse(csv, {
        headers: { 'Content-Type': 'text/csv' },
        status: 200,
      });
    }

    return NextResponse.json(compatPayload, { status: 200 });
  } catch (err) {
    Sentry.captureException(err);
    console.error('❌ Analytics error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}