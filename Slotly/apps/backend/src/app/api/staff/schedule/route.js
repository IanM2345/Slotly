// apps/backend/src/app/api/staff/schedule/route.js
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { PrismaClient } from "@/generated/prisma";
import { verifyToken } from "@/middleware/auth";

const prisma = new PrismaClient();

function toBool(v) { return String(v).toLowerCase() === "true"; }

async function getStaffFromToken(request) {
  try {
    const auth = request.headers.get("authorization") || request.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return { error: "Unauthorized", status: 401 };

    const token = auth.split(" ")[1];
    const { valid, decoded } = await verifyToken(token);
    if (!valid || (decoded.role !== "STAFF" && decoded.role !== "BUSINESS_OWNER")) {
      return { error: "Forbidden", status: 403 };
    }
    Sentry.setUser({ id: decoded.userId, role: decoded.role });
    return { userId: decoded.userId, role: decoded.role };
  } catch (err) {
    Sentry.captureException(err);
    return { error: "Token validation error", status: 500 };
  }
}

export async function GET(request) {
  try {
    const { userId, error, status } = await getStaffFromToken(request);
    if (error) return NextResponse.json({ error }, { status });

    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId") || undefined;
    const serviceId  = searchParams.get("serviceId")  || undefined;
    const statusStr  = (searchParams.get("status") || "").toUpperCase(); // PENDING/CONFIRMED/CANCELLED/NO_SHOW
    const isUpcoming = toBool(searchParams.get("upcoming") || "false");

    /** base where: only this staff member, business-scoped */
    const where = {
      staffId: userId,
      ...(businessId ? { businessId } : {}),
      ...(serviceId ? { serviceId } : {}),
    };

    // status filter
    if (statusStr && ["PENDING","CONFIRMED","CANCELLED","NO_SHOW","COMPLETED"].includes(statusStr)) {
      where.status = statusStr;
    }

    // upcoming = future startTime (exclude CANCELLED by default)
    if (isUpcoming) {
      where.startTime = { gte: new Date() };
      if (!where.status) {
        where.status = { in: ["PENDING","CONFIRMED","RESCHEDULED"] };
      }
    }

    const rows = await prisma.booking.findMany({
      where,
      orderBy: { startTime: "asc" },
      include: {
        service: { select: { id: true, name: true, price: true, duration: true } },
        user:    { select: { id: true, name: true, avatarUrl: true } },
      },
      take: 100,
    });

    // normalize to the exact shape the UI expects
    const bookings = rows.map(b => ({
      id: b.id,
      startTime: b.startTime,
      endTime: b.endTime,
      status: b.status,
      serviceId: b.service?.id || b.serviceId,
      serviceName: b.service?.name || "",
      servicePrice: b.service?.price ?? null,
      serviceDuration: b.service?.duration ?? null,
      customer: b.user ? { 
        id: b.user.id, 
        name: b.user.name, 
        avatarUrl: b.user.avatarUrl 
      } : null,
    }));

    return NextResponse.json({ bookings }, { status: 200 });
  } catch (err) {
    Sentry.captureException(err);
    console.error("GET /api/staff/schedule error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}