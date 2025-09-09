// apps/backend/src/app/api/staff/services/route.js
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

    const rows = await prisma.serviceStaff.findMany({
      where: {
        staffId: userId,
        ...(businessId ? { businessId } : {}),
      },
      select: {
        service: { select: { id: true, name: true, price: true, duration: true, businessId: true } },
      },
    });

    // de-dup just in case
    const seen = new Set();
    const services = rows
      .map(r => r.service)
      .filter(s => s && !seen.has(s.id) && seen.add(s.id));

    return NextResponse.json({ services }, { status: 200 });
  } catch (err) {
    Sentry.captureException(err);
    console.error("GET /api/staff/services error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}