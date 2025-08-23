import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
import { authenticateRequest } from "@/middleware/auth";
import { verify } from "@/lib/tokens";

const prisma = new PrismaClient();
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req) {
  try {
    const auth = await authenticateRequest(req); // requires access token
    const body = await req.json().catch(() => ({}));
    const { refreshToken, allDevices } = body || {};

    if (!auth.valid) {
      return NextResponse.json({ error: auth.error }, { status: 401, headers: CORS });
    }

    if (allDevices) {
      await prisma.refreshToken.updateMany({
        where: { userId: auth.decoded.sub, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else if (refreshToken) {
      try {
        const d = verify(refreshToken);
        if (d.type === "refresh" && d.sub === auth.decoded.sub && d.jti) {
          await prisma.refreshToken.updateMany({
            where: { jti: d.jti, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
      } catch { /* ignore */ }
    }

    return NextResponse.json({ ok: true }, { status: 200, headers: CORS });
  } catch {
    return NextResponse.json({ error: "Logout failed" }, { status: 500, headers: CORS });
  }
}
