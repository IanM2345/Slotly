import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
import { verify, signAccessToken, signRefreshToken, newJti } from "../../../../lib/token";

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
    const body = await req.json().catch(() => ({}));
    const { refreshToken } = body || {};
    if (!refreshToken) {
      return NextResponse.json({ error: "Missing refresh token" }, { status: 400, headers: CORS });
    }

    let decoded;
    try {
      decoded = verify(refreshToken);
    } catch {
      return NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401, headers: CORS });
    }
    if (decoded.type !== "refresh" || !decoded.jti || !decoded.sub) {
      return NextResponse.json({ error: "Invalid token payload" }, { status: 401, headers: CORS });
    }

    const dbTok = await prisma.refreshToken.findUnique({ where: { jti: decoded.jti } });
    if (!dbTok || dbTok.revokedAt || dbTok.expiresAt < new Date()) {
      return NextResponse.json({ error: "Refresh token no longer valid" }, { status: 401, headers: CORS });
    }

    // Rotate the refresh token
    const replacementJti = newJti();
    const replacementExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true, role: true, name: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404, headers: CORS });

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

    const newAccess = signAccessToken(user);
    const newRefresh = signRefreshToken(user, replacementJti);

    return NextResponse.json(
      { accessToken: newAccess, refreshToken: newRefresh, user },
      { status: 200, headers: CORS }
    );
  } catch (e) {
    return NextResponse.json({ error: "Refresh failed" }, { status: 500, headers: CORS });
  }
}
