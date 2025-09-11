// apps/backend/src/app/api/manager/analytics/route.js
import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
import * as Sentry from "@sentry/nextjs";
import { verifyToken } from "@/middleware/auth";

export const dynamic = "force-dynamic";
const prisma = globalThis._prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis._prisma = prisma;

function startOfDay(d = new Date()) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d = new Date())   { const x = new Date(d); x.setHours(23,59,59,999); return x; }

function rangeFromPeriod(period = "30d") {
  const now = new Date();
  if (period === "today") return { from: startOfDay(now), to: endOfDay(now) };
  const days = period === "7d" ? 7 : 30;
  const from = new Date(now);
  from.setDate(now.getDate() - (days - 1));
  from.setHours(0,0,0,0);
  return { from, to: endOfDay(now) };
}

function dayKey(date) { return new Date(date).toISOString().slice(0,10); } // YYYY-MM-DD

function bucketDate(b) {
  // prefer completedAt, then startTime, then createdAt
  return b.completedAt || b.startTime || b.createdAt;
}

export async function GET(req) {
  try {
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const token = auth.split(" ")[1];

    const { valid, decoded } = await verifyToken(token).catch(() => ({ valid: false }));
    if (!valid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = decoded?.userId || decoded?.sub || decoded?.id;
    if (!userId || decoded.role !== "BUSINESS_OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    Sentry.setUser({ id: userId, role: decoded.role });

    const biz = await prisma.business.findFirst({
      where: { ownerId: userId },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });
    if (!biz) return NextResponse.json({ error: "No business found" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "30d";
    const { from, to } = rangeFromPeriod(period);

    // Pull all bookings that touched the period (startTime, createdAt, OR completedAt)
    const bookings = await prisma.booking.findMany({
      where: {
        businessId: biz.id,
        OR: [
          { startTime: { gte: from, lte: to } },
          { createdAt: { gte: from, lte: to } },
          { completedAt: { gte: from, lte: to } },
        ],
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        startTime: true,
        completedAt: true,
        service: { select: { id: true, name: true, price: true } },
        payments: {
          where: { status: "SUCCESS", type: "BOOKING" },
          select: { amount: true }
        }
      },
      orderBy: { startTime: "asc" },
    });

    // Aggregate
    let total = 0, completed = 0, cancelled = 0, noShow = 0, revenueMinor = 0;
    const byDay = {};
    const byService = {};

    for (const b of bookings) {
      total += 1;
      if (b.status === "COMPLETED") completed += 1;
      else if (b.status === "CANCELLED") cancelled += 1;
      else if (b.status === "NO_SHOW") noShow += 1;

      // revenue from successful payment; if none & completed, fall back to service price
      const paid = Number(b.payments?.[0]?.amount || 0);
      const fallback = b.status === "COMPLETED" ? Number(b.service?.price || 0) : 0;
      const add = paid > 0 ? paid : fallback;
      revenueMinor += add;

      // Use bucketDate for the day key
      const d = dayKey(bucketDate(b));
      if (!byDay[d]) byDay[d] = { d, bookings: 0, revenueMinor: 0 };
      byDay[d].bookings += 1;
      byDay[d].revenueMinor += add;

      const svcName = b.service?.name || "Unknown";
      if (!byService[svcName]) byService[svcName] = { name: svcName, bookings: 0, revenueMinor: 0 };
      byService[svcName].bookings += 1;
      byService[svcName].revenueMinor += add;
    }

    // Ensure series covers all days in range (helps charts)
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const key = dayKey(d);
      if (!byDay[key]) byDay[key] = { d: key, bookings: 0, revenueMinor: 0 };
    }

    // KPIs expected by mobile frontend
    const kpis = {
      totalBookings: total,
      completed,
      cancelled,
      noShow,
      revenueMinor,            // cents/minor units
      period,
    };

    const payload = {
      meta: { businessId: biz.id, from, to, period },
      kpis,
      series: {
        byDay: Object.values(byDay).sort((a, b) => (a.d < b.d ? -1 : 1)),
        byService: Object.values(byService).sort((a, b) => b.bookings - a.bookings),
      },
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    console.error("GET /api/manager/analytics error:", err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}