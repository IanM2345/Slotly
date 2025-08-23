// apps/backend/src/app/api/businesses/verification/latest/route.js
import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
import { requireAuth } from "../../../../../../lib/token";

const prisma = globalThis._prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis._prisma = prisma;

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const user = await requireAuth(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const business = await prisma.business.findFirst({
      where: { ownerId: user.id },
      select: { id: true },
    });

    if (!business) {
      return NextResponse.json({ business: null, latest: null, status: "NONE" }, { status: 200 });
    }

    const latest = await prisma.businessVerification.findFirst({
      where: { businessId: business.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, createdAt: true },
    });

    const status = (latest?.status ?? "PENDING").toUpperCase();
    return NextResponse.json(
      {
        businessId: business.id,
        latest, // {id,status,createdAt} | null when none exists
        status, // PENDING if none exists yet
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/businesses/verification/latest error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}