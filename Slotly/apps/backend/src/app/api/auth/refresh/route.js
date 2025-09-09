// apps/backend/src/app/api/auth/refresh/route.js
import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
import {
  verifyRefresh,
  signAccessToken,
  signRefreshToken,
  newJti,
} from "../../../../lib/token";

export const dynamic = "force-dynamic";

// Reuse Prisma in dev to avoid client explosions
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
      return NextResponse.json(
        { error: "Missing refresh token" },
        { status: 400, headers: CORS }
      );
    }

    // 1) Verify incoming refresh
    let decoded;
    try {
      decoded = verifyRefresh(refreshToken);
    } catch (e) {
      const code =
        e?.name === "TokenExpiredError"
          ? "EXPIRED_REFRESH"
          : e?.name === "JsonWebTokenError"
          ? "INVALID_REFRESH"
          : "REFRESH_VERIFY_FAILED";
      return NextResponse.json(
        { error: "Invalid or expired refresh token", code },
        { status: 401, headers: CORS }
      );
    }

    if (decoded.type !== "refresh" || !decoded.jti || !decoded.sub) {
      return NextResponse.json(
        { error: "Invalid token payload" },
        { status: 401, headers: CORS }
      );
    }

    // 2) Ensure DB record is valid
    const dbTok = await prisma.refreshToken.findUnique({
      where: { jti: decoded.jti },
    });

    if (!dbTok || dbTok.revokedAt || dbTok.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Refresh token no longer valid" },
        { status: 401, headers: CORS }
      );
    }

    // 3) Load user
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true, role: true, name: true },
    });
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers: CORS }
      );
    }

    // 4) Rotate with retry-on-conflict (fixes P2034 deadlocks)
    const replacementJti = newJti();
    const replacementExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30d

    const MAX_RETRIES = 5;
    let attempt = 0;
    let rotated = false;
    let lastErr = null;

    while (!rotated && attempt < MAX_RETRIES) {
      try {
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

        rotated = true;
      } catch (err) {
        lastErr = err;
        // Prisma deadlock / write-conflict: P2034 → retry with a tiny backoff
        const code = err?.code || "";
        if (code === "P2034" || /deadlock|write conflict/i.test(String(err?.message))) {
          attempt += 1;
          const backoff = 100 + Math.floor(Math.random() * 200) * attempt;
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }
        // Other errors → bail
        throw err;
      }
    }

    if (!rotated) {
      // Last ditch: mark old token as replaced if possible to avoid loops
      try {
        await prisma.refreshToken.update({
          where: { jti: decoded.jti },
          data: { revokedAt: new Date(), replacedBy: replacementJti },
        });
      } catch (_) {}
      return NextResponse.json(
        { error: "Could not rotate refresh token. Please login again." },
        { status: 500, headers: CORS }
      );
    }

    // 5) Issue fresh tokens
    const accessToken = signAccessToken(user);
    const newRefresh = signRefreshToken(user, replacementJti);

    return NextResponse.json(
      { accessToken, refreshToken: newRefresh, user },
      { status: 200, headers: CORS }
    );
  } catch (error) {
    console.error("POST /api/auth/refresh error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500, headers: CORS }
    );
  }
}
