// apps/backend/src/app/api/auth/me/route.js
import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
import { authenticateRequest } from "@/middleware/auth";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

// ✅ Prisma singleton (no disconnect in finally)
const prisma = globalThis._prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis._prisma = prisma;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  Vary: "Origin",
};

export async function GET(req) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      Sentry.addBreadcrumb({
        message: "Missing Authorization header",
        category: "auth",
        level: "warning",
        data: { endpoint: "/api/auth/me" },
      });
      return NextResponse.json(
        {
          error:
            "Authorization header is required. Please include 'Authorization: Bearer <token>' in your request.",
          authenticated: false,
          timestamp: new Date().toISOString(),
        },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    // Validate access token (your authenticateRequest should enforce access type)
    const auth = await authenticateRequest(req);
    if (!auth.valid) {
      Sentry.addBreadcrumb({
        message: "Authentication failed",
        category: "auth",
        level: "warning",
        data: { error: auth.error, endpoint: "/api/auth/me" },
      });
      return NextResponse.json(
        {
          error: auth.error,
          authenticated: false,
          timestamp: new Date().toISOString(),
          hint:
            "Make sure your token is valid and not expired. Use the token from /api/auth/login response.",
        },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    // Get user id from token
    const userId = auth.decoded?.sub || auth.decoded?.id;
    if (!userId) {
      const err = new Error("No user ID found in decoded token");
      Sentry.captureException(err, {
        tags: { endpoint: "/api/auth/me", error_type: "invalid_token_payload" },
        contexts: { token: { decoded: auth.decoded } },
      });
      return NextResponse.json(
        {
          error: "Invalid token payload - missing user ID",
          authenticated: false,
          timestamp: new Date().toISOString(),
        },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    // Load user (minimal fields)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        name: true,
        createdAt: true,
      },
    });

    if (!user) {
      Sentry.captureMessage("User not found during authentication check", {
        level: "warning",
        tags: { endpoint: "/api/auth/me", user_id: userId },
        contexts: { auth: { token_valid: true, user_id_from_token: userId } },
      });
      return NextResponse.json(
        {
          error: "User not found",
          authenticated: false,
          timestamp: new Date().toISOString(),
        },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // OPTIONAL: robust business-suspension check (won’t crash /me)
    let hasSuspendedBusiness = false;
    try {
      const suspendedBiz = await prisma.business.findFirst({
        where: { ownerId: user.id, suspended: true },
        select: { id: true },
      });
      hasSuspendedBusiness = !!suspendedBiz;
    } catch (e) {
      // This is the bit that used to throw “Engine was empty”.
      // We swallow/log it so /me stays resilient.
      console.warn(
        "Could not check business suspension status:",
        e?.message || e
      );
      hasSuspendedBusiness = false;
    }

    // Sentry user context
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.name,
      role: user.role,
    });

    const responseData = {
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        name: user.name,
        role: user.role,
      },
      metadata: {
        memberSince: user.createdAt,
        hasSuspendedBusiness,
      },
      session: {
        tokenType: auth.decoded?.type || "access",
        issuedAt: auth.decoded?.iat
          ? new Date(auth.decoded.iat * 1000).toISOString()
          : null,
        expiresAt: auth.decoded?.exp
          ? new Date(auth.decoded.exp * 1000).toISOString()
          : null,
        timeUntilExpiry: auth.decoded?.exp
          ? auth.decoded.exp * 1000 - Date.now()
          : null,
      },
      timestamp: new Date().toISOString(),
    };

    Sentry.addBreadcrumb({
      message: "Successful authentication check",
      category: "auth",
      level: "info",
      data: { user_id: user.id, user_role: user.role, endpoint: "/api/auth/me" },
    });

    return NextResponse.json(responseData, { status: 200, headers: CORS_HEADERS });
  } catch (error) {
    console.error("Auth me endpoint error:", error);
    Sentry.captureException(error, {
      tags: { endpoint: "/api/auth/me", error_type: "internal_server_error" },
      contexts: {
        request: {
          url: req.url,
          method: req.method,
          headers: {
            "user-agent": req.headers.get("user-agent"),
            referer: req.headers.get("referer"),
            authorization: req.headers.get("authorization") ? "present" : "missing",
          },
        },
      },
    });
    return NextResponse.json(
      {
        error: "Internal server error",
        authenticated: false,
        timestamp: new Date().toISOString(),
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

// CORS preflight
export async function OPTIONS() {
  return NextResponse.json({}, { status: 200, headers: CORS_HEADERS });
}
