import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
import { requireAuth, verifyToken } from "../../../../lib/token";
import * as Sentry from "@sentry/nextjs";
import bcrypt from "bcryptjs";

const prisma = globalThis._prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis._prisma = prisma;

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    // Fix: requireAuth returns { id, role, email } directly, not { decoded }
    const { id } = await requireAuth(req); // throws with code on fail

    // get user + business
    const user = await prisma.user.findUnique({
      where: { id }, // Fix: use id directly instead of decoded.id
      select: { id: true, email: true, phone: true, role: true },
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const business = await prisma.business.findFirst({
      where: { ownerId: user.id },
      select: { id: true, name: true, plan: true, createdAt: true },
    });

    let verificationStatus = null;
    let latestVerification = null;
    if (business?.id) {
      const latest = await prisma.businessVerification.findFirst({
        where: { businessId: business.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, createdAt: true },
      });
      verificationStatus = latest?.status ?? "PENDING";
      latestVerification = latest
        ? { id: latest.id, status: latest.status, createdAt: latest.createdAt }
        : null;
    }

    return NextResponse.json(
      {
        id: user.id,
        email: user.email ?? null,
        phone: user.phone ?? null,
        role: user.role,
        business: business
          ? {
              ...business,
              verificationStatus: String(verificationStatus || "PENDING").toLowerCase(),
              hasVerification: !!latestVerification,
              latestVerification,
            }
          : null,
      },
      { status: 200 }
    );
  } catch (err) {
    // Map auth failures to 401 instead of 500
    if (err?.code === "NO_TOKEN" || err?.code === "INVALID_TOKEN" || err?.code === "EXPIRED_TOKEN") {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 401 });
    }
    console.error("GET /api/users/me error:", err);
    Sentry.captureException?.(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];
    
    // Fix: verifyToken now returns decoded payload directly or throws
    let decoded;
    try {
      decoded = verifyToken(token); // returns decoded or throws
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    if (decoded.role !== "CUSTOMER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, phone, password } = await request.json();
    if (!name && !phone && !password) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const data = {};
    if (name) data.name = name;
    if (phone) data.phone = phone;
    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters long" }, { status: 400 });
      }
      data.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: decoded.id },
      data,
      select: { id: true, email: true, name: true, phone: true, role: true, createdAt: true },
    });

    return NextResponse.json(updatedUser, { status: 200 });
  } catch (error) {
    console.error("Error updating user:", error);
    Sentry.captureException?.(error);
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
    
    // Fix: verifyToken now returns decoded payload directly or throws
    let decoded;
    try {
      decoded = verifyToken(token); // returns decoded or throws
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    if (decoded.role !== "CUSTOMER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.staffEnrollment.deleteMany({ where: { userId: decoded.id } });
    await prisma.booking.deleteMany({ where: { userId: decoded.id } });
    await prisma.user.delete({ where: { id: decoded.id } });

    return NextResponse.json({ message: "User deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error deleting user:", error);
    Sentry.captureException?.(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}