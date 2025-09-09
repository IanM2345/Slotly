// apps/backend/src/app/api/manager/me/route.js
import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
import * as Sentry from "@sentry/nextjs";
import { verifyToken } from "@/middleware/auth";

export const dynamic = "force-dynamic";

// Reuse Prisma in dev
const prisma = globalThis._prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis._prisma = prisma;

const DEFAULT_DAY = { open: true, start: '09:00', end: '20:00' };
const DEFAULT_HOURS = {
  monday: { ...DEFAULT_DAY },
  tuesday: { ...DEFAULT_DAY },
  wednesday: { ...DEFAULT_DAY },
  thursday: { ...DEFAULT_DAY },
  friday: { ...DEFAULT_DAY },
  saturday: { ...DEFAULT_DAY },
  sunday: { ...DEFAULT_DAY },
};

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

    // Be liberal in what we accept from the token payload
    const userId = decoded?.userId || decoded?.sub || decoded?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized (no user id in token)" }, { status: 401 });
    }

    // Check role if needed
    if (decoded.role !== 'BUSINESS_OWNER') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Set Sentry user context
    Sentry.setUser({ id: userId, role: decoded.role });

    const [business, owner] = await Promise.all([
      prisma.business.findFirst({ 
        where: { ownerId: userId },
        include: {
          verification: { 
            select: { status: true, reviewedAt: true, createdAt: true } 
          },
          subscription: { 
            select: { plan: true, isActive: true, startDate: true, endDate: true } 
          },
        }
      }),
      prisma.user.findUnique({ 
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
        }
      }),
    ]);

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    if (!owner) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Include phone/email from owner, and default hours in the response
    const response = {
      ...business,
      hours: business?.hours ?? DEFAULT_HOURS,
      phone: owner?.phone ?? null,
      email: owner?.email ?? null,
      verificationStatus: business.verification?.status ?? null,
      verificationReviewedAt: business.verification?.reviewedAt ?? null,
      subscription: business.subscription ?? null,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error("GET /api/manager/me error:", err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request) {
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

    Sentry.setUser({ id: userId, role: decoded.role });

    const payload = await request.json();
    const { logoUrl, name, description, address, latitude, longitude, hours, phone, email } = payload || {};

    const existing = await prisma.business.findFirst({ where: { ownerId: userId } });
    if (!existing) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Update Business
    const updatedBusiness = await prisma.business.update({
      where: { id: existing.id },
      data: {
        ...(logoUrl !== undefined ? { logoUrl } : {}),
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(address !== undefined ? { address } : {}),
        ...(latitude !== undefined ? { latitude } : {}),
        ...(longitude !== undefined ? { longitude } : {}),
        ...(hours !== undefined ? { hours } : {}),
      },
      include: {
        verification: { 
          select: { status: true, reviewedAt: true, createdAt: true } 
        },
        subscription: { 
          select: { plan: true, isActive: true, startDate: true, endDate: true } 
        },
      }
    });

    // Update owner User (phone/email)
    let updatedOwner = null;
    if (phone !== undefined || email !== undefined) {
      updatedOwner = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(phone !== undefined ? { phone } : {}),
          ...(email !== undefined ? { email } : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
        }
      });
    } else {
      updatedOwner = await prisma.user.findUnique({ 
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
        }
      });
    }

    // Return merged view (business + contact + default hours)
    const response = {
      ...updatedBusiness,
      hours: updatedBusiness.hours ?? DEFAULT_HOURS,
      phone: updatedOwner?.phone ?? null,
      email: updatedOwner?.email ?? null,
      verificationStatus: updatedBusiness.verification?.status ?? null,
      verificationReviewedAt: updatedBusiness.verification?.reviewedAt ?? null,
      subscription: updatedBusiness.subscription ?? null,
    };

    return NextResponse.json({ message: "Business updated successfully", business: response }, { status: 200 });
  } catch (err) {
    console.error("PUT /api/manager/me error:", err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request) {
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

    Sentry.setUser({ id: userId, role: decoded.role });

    const business = await prisma.business.findFirst({ where: { ownerId: userId } });
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    await prisma.business.delete({ where: { id: business.id } });

    return NextResponse.json({ message: "Business deleted successfully" }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/manager/me error:", err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}