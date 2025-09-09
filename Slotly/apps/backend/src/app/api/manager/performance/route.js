// apps/backend/src/app/api/manager/performance/route.js
import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
import * as Sentry from "@sentry/nextjs";
import { verifyToken } from "@/middleware/auth";
import { parseISO } from "date-fns";

export const dynamic = "force-dynamic";

// Reuse Prisma in dev
const prisma = globalThis._prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis._prisma = prisma;

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export async function GET(request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];

    const { valid, decoded } = await verifyToken(token).catch(() => ({ valid: false }));
    if (!valid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = decoded?.userId || decoded?.sub || decoded?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized (no user id in token)" }, { status: 401 });
    }

    if (decoded.role !== 'BUSINESS_OWNER') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Set Sentry user context
    Sentry.setUser({ id: userId, role: decoded.role });

    // Pick the latest owned business as the context
    const business = await prisma.business.findFirst({
      where: { ownerId: userId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (!business) {
      return NextResponse.json({ error: "No business found for user" }, { status: 404 });
    }

    const businessId = business.id;

    // Parse date filters from query params
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');
    
    // Use provided dates or default to today
    const from = startDate ? parseISO(startDate) : startOfDay();
    const to = endDate ? parseISO(endDate) : endOfDay();

    const dateFilter = { gte: from, lte: to };

    const whereBase = {
      businessId: businessId,
      createdAt: dateFilter,
    };

    // ✅ Correct enum spelling from your schema (BookingStatus.CANCELLED)
    const [totalBookings, pending, confirmed, completed, cancelled, noShows] = await Promise.all([
      prisma.booking.count({ where: whereBase }),
      prisma.booking.count({ where: { ...whereBase, status: "PENDING" } }),
      prisma.booking.count({ where: { ...whereBase, status: "CONFIRMED" } }),
      prisma.booking.count({ where: { ...whereBase, status: "COMPLETED" } }),
      prisma.booking.count({ where: { ...whereBase, status: "CANCELLED" } }), // ✅ Fixed spelling
      prisma.booking.count({ where: { ...whereBase, status: "NO_SHOW" } }),
    ]);

    // Revenue calculations
    const totalRevenue = await prisma.payment.aggregate({
      _sum: { amount: true, fee: true },
      where: {
        status: 'SUCCESS',
        createdAt: dateFilter,
        booking: {
          businessId,
          status: 'COMPLETED',
          createdAt: dateFilter,
        },
      },
    });

    const revenue = totalRevenue._sum.amount ?? 0;
    const fees = totalRevenue._sum.fee ?? 0;

    // Calculate metrics
    const completedBookingsCount = completed;
    const averageTicketSize = completedBookingsCount > 0 ? Math.round(revenue / completedBookingsCount) : 0;

    // Top services analytics
    const topServices = await prisma.booking.groupBy({
      by: ['serviceId'],
      where: { businessId, createdAt: dateFilter },
      _count: { serviceId: true },
      orderBy: { _count: { serviceId: 'desc' } },
      take: 5,
    });

    const serviceIds = topServices.map(s => s.serviceId);
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, name: true, price: true },
    });

    const topServiceAnalytics = topServices.map(s => {
      const service = services.find(serv => serv.id === s.serviceId);
      return {
        serviceId: s.serviceId,
        name: service?.name || 'Unknown',
        bookingsCount: s._count.serviceId,
        price: service?.price || 0,
      };
    });

    // Staff leaderboard
    const staffStats = await prisma.booking.groupBy({
      by: ['staffId'],
      where: {
        businessId,
        status: 'COMPLETED',
        staffId: { not: null },
        createdAt: dateFilter,
      },
      _count: { staffId: true },
      orderBy: { _count: { staffId: 'desc' } },
      take: 5,
    });

    const staffIds = staffStats.map(s => s.staffId);
    const staffDetails = await prisma.user.findMany({
      where: { id: { in: staffIds } },
      select: { id: true, name: true, email: true },
    });

    const staffLeaderboard = staffStats.map(s => {
      const staff = staffDetails.find(st => st.id === s.staffId);
      return {
        staffId: s.staffId,
        name: staff?.name || 'Unknown',
        email: staff?.email || 'Unknown',
        bookingsCount: s._count.staffId,
      };
    });

    // Monthly breakdown (safer approach without raw queries for now)
    let monthlyBreakdown = [];
    try {
      // You can implement this with regular Prisma queries if needed
      // For now, leaving it empty to avoid potential raw query issues
      monthlyBreakdown = [];
    } catch (rawErr) {
      Sentry.captureException(rawErr);
      monthlyBreakdown = [];
    }

    return NextResponse.json(
      {
        businessId: businessId,
        range: { from, to },
        bookings: {
          total: totalBookings,
          pending,
          confirmed,
          completed,
          cancelled, // ✅ now spelled correctly
          noShows,
        },
        revenue: {
          gross: revenue,
          fees,
          net: revenue - fees,
          currency: "KES",
        },
        metrics: {
          totalRevenue: revenue,
          totalBookings,
          cancelledBookings: cancelled,
          noShows,
          completedBookings: completedBookingsCount,
          averageTicketSize,
        },
        analytics: {
          topServices: topServiceAnalytics,
          staffLeaderboard,
          monthlyBreakdown,
        }
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/manager/performance error:", err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}