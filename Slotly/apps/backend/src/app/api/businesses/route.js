import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
import { requireAuth } from "../../../../src/lib/token"; // same helper you use elsewhere

const prisma = globalThis._prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis._prisma = prisma;

export const dynamic = "force-dynamic";

// Accepts: "LEVEL_3", "LEVEL3", "level3", 3
function normalizePlan(input) {
  const s = String(input ?? "LEVEL_1").toUpperCase().replace(/[\s-]+/g, "");
  const m = /^LEVEL_?([1-6])$/.exec(s) || /^([1-6])$/.exec(s);
  return m ? `LEVEL_${m[1]}` : "LEVEL_1";
}

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
      plan,   // NEW (string/number, various shapes accepted)
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

    // Normalize/validate plan against Prisma enum shape
    const planEnum = normalizePlan(plan); // defaults to LEVEL_1 if not provided

    const business = await prisma.business.create({
      data: {
        name: name.trim(),
        description: description?.trim() ?? null,
        ownerId: user.id,
        type: type || "INFORMAL",
        address: address.trim(),
        latitude: Number(latitude),
        longitude: Number(longitude),
        plan: planEnum,
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

export async function GET() {
  try {
    const items = await prisma.business.findMany({
      select: {
        id: true, 
        name: true, 
        address: true, 
        latitude: true, 
        longitude: true, 
        logoUrl: true,
        plan: true, // Include plan in GET response
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ businesses: items }, { status: 200 });
  } catch (err) {
    console.error('GET /api/businesses error:', err);
    return NextResponse.json({ message: 'Internal error' }, { status: 500 });
  }
}