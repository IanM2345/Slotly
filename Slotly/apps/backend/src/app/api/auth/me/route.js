// apps/backend/src/app/api/auth/me/route.js
import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
import { requireAuth } from "@/lib/token";

export const dynamic = "force-dynamic";


const prisma = globalThis._prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis._prisma = prisma;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": 
    "Content-Type, Authorization, X-Session, X-Path, X-App-Build",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Pragma": "no-cache",
  "Vary": "Origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200, headers: CORS_HEADERS });
}

export async function GET(req) {
  const startTime = Date.now();
  
  try {
    // 🔐 Validate access token using your existing helper
    const { id: userId, role, email } = await requireAuth(req);

    // 🧭 Extract optional session-telemetry headers
    const jti = req.headers.get("x-session")?.trim() || undefined;
    const path = req.headers.get("x-path")?.trim() || undefined;
    const appBuild = req.headers.get("x-app-build")?.trim() || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;
    const clientIp = getClientIp(req);

    // 📝 Update session activity (non-blocking, best-effort)
    if (jti) {
      updateSessionActivity(jti, userId, {
        path,
        userAgent,
        ip: clientIp,
        appBuild
      }).catch(err => {
        // Log but don't fail the request
        Sentry.captureException(err, {
          tags: { 
            endpoint: "/api/auth/me", 
            phase: "session_update",
            user_id: userId 
          },
          extra: { jti, path }
        });
      });
    }

    // 👤 Load user with minimal required fields
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      Sentry.captureMessage("User not found during /api/auth/me check", {
        level: "warning",
        tags: { endpoint: "/api/auth/me", user_id: userId },
      });
      return NextResponse.json(
        { 
          error: "User not found", 
          authenticated: false,
          timestamp: new Date().toISOString()
        },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // 🏢 Optional business suspension check (non-blocking)
    let hasSuspendedBusiness = false;
    if (user.role === "BUSINESS_OWNER" || user.role === "ADMIN") {
      try {
        const suspendedBiz = await prisma.business.findFirst({
          where: { ownerId: user.id, suspended: true },
          select: { id: true },
        });
        hasSuspendedBusiness = !!suspendedBiz;
      } catch (e) {
        console.warn("Could not check business suspension status:", e?.message);
        // Continue without failing
      }
    }

    // 🎯 Set Sentry user context
    Sentry.setUser({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // ✅ Build response payload
    const responseData = {
      ok: true,
      authenticated: true,
      user: {
        id: user.id,
        email: user.email ?? null,
        phone: user.phone ?? null,
        name: user.name ?? null,
        role: user.role ?? role ?? "CUSTOMER",
      },
      metadata: {
        memberSince: user.createdAt,
        lastUpdated: user.updatedAt,
        hasSuspendedBusiness,
        sessionTracked: !!jti,
      },
      serverTime: new Date().toISOString(),
      responseTime: Date.now() - startTime,
    };

    // 📊 Success breadcrumb
    Sentry.addBreadcrumb({
      message: "Successful /api/auth/me check",
      category: "auth",
      level: "info",
      data: { 
        user_id: user.id, 
        user_role: user.role, 
        has_session: !!jti,
        response_time: Date.now() - startTime
      },
    });

    return NextResponse.json(responseData, { 
      status: 200, 
      headers: CORS_HEADERS 
    });

  } catch (err) {
    const responseTime = Date.now() - startTime;
    
    // Handle known auth errors from requireAuth
    const authErrorCodes = ["NO_TOKEN", "INVALID_TOKEN", "EXPIRED_TOKEN"];
    if (authErrorCodes.includes(err?.code)) {
      Sentry.addBreadcrumb({
        message: "Authentication failed in /api/auth/me",
        category: "auth",
        level: "warning",
        data: { 
          error: err.message, 
          code: err.code,
          response_time: responseTime
        },
      });

      return NextResponse.json(
        {
          error: err.message || "Unauthorized",
          code: err.code,
          authenticated: false,
          timestamp: new Date().toISOString(),
        },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    // Handle unexpected errors
    console.error("Unexpected error in /api/auth/me:", err);
    Sentry.captureException(err, {
      tags: { 
        endpoint: "/api/auth/me", 
        error_type: "internal_server_error" 
      },
      extra: { response_time: responseTime }
    });

    return NextResponse.json(
      {
        error: "Internal Server Error",
        authenticated: false,
        timestamp: new Date().toISOString(),
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

/**
 * Extract client IP from various possible headers
 */
function getClientIp(req) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||  // Cloudflare
    req.headers.get("x-client-ip") ||
    undefined
  );
}

/**
 * Update session activity in background (non-blocking)
 */
async function updateSessionActivity(jti, userId, metadata = {}) {
  if (!jti || !userId) return;

  const updateData = {
    lastSeenAt: new Date(),
    ...(metadata.path && { lastPath: metadata.path }),
    ...(metadata.userAgent && { userAgent: metadata.userAgent }),
    ...(metadata.ip && { ip: metadata.ip }),
    ...(metadata.appBuild && { appVersion: metadata.appBuild }),
  };

  // Use updateMany to avoid errors if JTI doesn't exist
  await prisma.refreshToken.updateMany({
    where: { 
      jti, 
      userId,
      // Optionally ensure token is still valid
      expiresAt: { gt: new Date() }
    },
    data: updateData,
  });
}