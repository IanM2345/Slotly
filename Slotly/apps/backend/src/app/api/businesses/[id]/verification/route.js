import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
import { requireAuth, verifyToken } from "@/lib/token"; // Fixed: use the correct token helper path
import * as Sentry from '@sentry/nextjs';
import bcrypt from 'bcryptjs';

const prisma = globalThis._prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis._prisma = prisma;

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const user = await requireAuth(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // One-business-per-owner assumption
    const business = await prisma.business.findFirst({
      where: { ownerId: user.id },
      select: { id: true, name: true, plan: true, createdAt: true },
    });

    let verificationStatus = null;
    if (business?.id) {
      const latest = await prisma.businessVerification.findFirst({
        where: { businessId: business.id },
        orderBy: { createdAt: "desc" },
        select: { status: true },
      });
      verificationStatus = latest?.status ?? "PENDING"; // Default to PENDING if no verification exists
    }

    return NextResponse.json(
      {
        id: user.id,
        email: user.email || null,
        phone: user.phone || null,
        role: user.role,
        business: business
          ? {
              ...business,
              verificationStatus: verificationStatus?.toLowerCase?.() || "pending",
            }
          : null,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/users/me error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);

    if (!valid || !decoded || decoded.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, phone, password } = body;

    if (!name && !phone && !password) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    let hashedPassword = undefined;
    if (password) {
      if (password.length < 6) {
        return NextResponse.json(
          { error: 'Password must be at least 6 characters long' },
          { status: 400 }
        );
      }
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: decoded.id },
      data: {
        ...(name && { name }),
        ...(phone && { phone }),
        ...(hashedPassword && { password: hashedPassword }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(updatedUser, { status: 200 });
  } catch (error) {
    console.error('Error updating user:', error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { valid, decoded } = await verifyToken(token);

    if (!valid || !decoded || decoded.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.staffEnrollment.deleteMany({
      where: { userId: decoded.id },
    });

    await prisma.booking.deleteMany({
      where: { userId: decoded.id },
    });

    await prisma.user.delete({
      where: { id: decoded.id },
    });

    return NextResponse.json({ message: 'User deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting user:', error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const user = await requireAuth(req);
    const businessId = params?.id;
    if (!businessId) {
      return NextResponse.json({ error: "Missing business id" }, { status: 400 });
    }

    // Ensure the authenticated user owns this business
    const biz = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, ownerId: true },
    });
    if (!biz || biz.ownerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      type = "INFORMAL",
      idNumber = "",
      regNumber = null,
      idPhotoUrl,
      selfieWithIdUrl = null,
      licenseUrl = null,
    } = body || {};

    // Minimal validation
    if (!idPhotoUrl) {
      return NextResponse.json({ error: "idPhotoUrl is required" }, { status: 400 });
    }
    if (String(type).toUpperCase() === "FORMAL" && !idNumber) {
      return NextResponse.json({ error: "idNumber required for FORMAL verification" }, { status: 400 });
    }

    // Upsert: one verification row per business (model has unique businessId)
    const verification = await prisma.businessVerification.upsert({
      where: { businessId },
      update: {
        type,
        idNumber,
        regNumber,
        idPhotoUrl,
        selfieWithIdUrl,
        licenseUrl,
        status: "PENDING",
        reviewedAt: null,
      },
      create: {
        businessId,
        type,
        idNumber,
        regNumber,
        idPhotoUrl,
        selfieWithIdUrl,
        licenseUrl,
        status: "PENDING",
      },
      select: { id: true, status: true, type: true },
    });

    return NextResponse.json({ ok: true, verification }, { status: 200 });
  } catch (err) {
    console.error("POST /api/businesses/[id]/verification error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}