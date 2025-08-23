// apps/backend/src/app/api/businesses/route.js
import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
import { requireAuth } from "../../../../src/lib/token"; // same helper you use elsewhere

const prisma = globalThis._prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis._prisma = prisma;

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const user = await requireAuth(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    const {
      name,
      description,
      address,
      latitude,
      longitude,
      type, // "FORMAL" | "INFORMAL"
      // payout
      payoutType,
      mpesaPhoneNumber,
      tillNumber,
      paybillNumber,
      accountRef,
      bankName,
      bankAccount,
      accountName,
    } = body;

    // basic guards (the client already validates; this is just a safety net)
    if (!name || !address || latitude == null || longitude == null) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // one business per owner for now
    const existing = await prisma.business.findFirst({
      where: { ownerId: user.id },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: "You already have a business" }, { status: 409 });
    }

    const business = await prisma.business.create({
      data: {
        name: name.trim(),
        description: description?.trim() ?? null,
        ownerId: user.id,
        type: type || "INFORMAL",
        address: address.trim(),
        latitude: Number(latitude),
        longitude: Number(longitude),
        payoutType: payoutType ?? null,
        mpesaPhoneNumber: mpesaPhoneNumber ?? null,
        tillNumber: tillNumber ?? null,
        paybillNumber: paybillNumber ?? null,
        accountRef: accountRef ?? null,
        bankName: bankName ?? null,
        bankAccount: bankAccount ?? null,
        accountName: accountName ?? null,
      },
      select: { id: true, name: true, plan: true },
    });

    return NextResponse.json({ ok: true, business }, { status: 201 });
  } catch (err) {
    console.error("POST /api/businesses error:", err);
    return NextResponse.json({ error: "Failed to create business" }, { status: 500 });
  }
}
