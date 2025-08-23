import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
import { requireAuth, verifyToken } from "../../../../lib/token";
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