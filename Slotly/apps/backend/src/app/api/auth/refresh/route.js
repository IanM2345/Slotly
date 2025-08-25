import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
import { verifyRefresh, signAccessToken, signRefreshToken, newJti } from "../../../../lib/token";

export const dynamic = "force-dynamic";

// Reuse Prisma in dev to avoid too many clients
const prisma = globalThis._prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis._prisma = prisma;

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
    const body = await req.json().catch(() => ({}));
    const { refreshToken } = body || {};

    if (!refreshToken) {
      return NextResponse.json({ error: "Missing refresh token" }, { status: 400, headers: CORS });
    }

    // ✅ validate refresh token
    let decoded;
    try {
      decoded = verifyRefresh(refreshToken); // throws if expired/invalid
    } catch (e) {
      const code =
        e?.name === "TokenExpiredError" ? "EXPIRED_REFRESH" :
        e?.name === "JsonWebTokenError" ? "INVALID_REFRESH" :
        "REFRESH_VERIFY_FAILED";
      return NextResponse.json({ error: "Invalid or expired refresh token", code }, { status: 401, headers: CORS });
    }

    // payload sanity
    if (decoded.type !== "refresh" || !decoded.jti || !decoded.sub) {
      return NextResponse.json({ error: "Invalid token payload" }, { status: 401, headers: CORS });
    }

    // check DB token record
    const dbTok = await prisma.refreshToken.findUnique({ where: { jti: decoded.jti } });
    if (!dbTok || dbTok.revokedAt || dbTok.expiresAt < new Date()) {
      return NextResponse.json({ error: "Refresh token no longer valid" }, { status: 401, headers: CORS });
    }

    // load user
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true, role: true, name: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404, headers: CORS });
    }

    // rotate refresh
    const replacementJti = newJti();
    const replacementExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30d; or read from env

    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { jti: decoded.jti },
        data: { revokedAt: new Date(), replacedBy: replacementJti },
      }),
      prisma.refreshToken.create({
        data: {
          jti: replacementJti,
          userId: user.id,
          expiresAt: replacementExpiry,
        },
      }),
    ]);

    // issue new tokens
    const accessToken = signAccessToken(user);
    const newRefresh = signRefreshToken(user, replacementJti);

    return NextResponse.json(
      { accessToken, refreshToken: newRefresh, user },
      { status: 200, headers: CORS }
    );
  } catch (e) {
    console.error("POST /api/auth/refresh error:", e);
    return NextResponse.json({ error: "Refresh failed" }, { status: 500, headers: CORS });
  }
}
