// apps/backend/src/middleware/auth.js
import * as Sentry from "@sentry/nextjs";
import { verifyAccess } from "../lib/token"; // from your token helper
// No jsonwebtoken import needed if we centralize on verifyAccess

function getBearer(req) {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const [scheme, token] = h.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

function extractToken(req) {
  // Works for NextRequest and plain Request
  const headers = typeof req?.headers?.get === "function"
    ? req.headers
    : new Headers(req?.headers || {});

  // 1) Authorization: Bearer <token>
  const auth = headers.get("authorization") || headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();

  // 2) Cookie: access_token=<token>
  const cookie = headers.get("cookie");
  if (cookie) {
    const m = cookie.match(/(?:^|;\s*)access_token=([^;]+)/);
    if (m) return decodeURIComponent(m[1]);
  }
  return null;
}

/**
 * Authenticates a Next.js Request using an ACCESS token.
 * Returns { valid, decoded?, error? }
 */
export async function authenticateRequest(req) {
  try {
    const token = extractToken(req);
    if (!token) {
      return { valid: false, decoded: null, error: "NO_TOKEN" };
    }

    // Verify using the shared helper (keeps secrets/algorithms in one place)
    let decoded;
    try {
      decoded = verifyAccess(token);
    } catch (e) {
      // mirror your error shapes below
      return { valid: false, decoded: null, error: "INVALID_TOKEN" };
    }

    // Enforce access-token semantics here if your helper doesn't
    if (decoded?.type && decoded.type !== "access") {
      return { valid: false, decoded: null, error: "INVALID_TOKEN_TYPE" };
    }

    if (!decoded?.sub) {
      return { valid: false, decoded: null, error: "MISSING_SUBJECT" };
    }

    // Enhance the decoded token with businessId if present
    // This supports the improved getBusinessFromToken logic
    const enhancedDecoded = {
      ...decoded,
      userId: decoded.sub || decoded.userId || decoded.id,
      businessId: decoded.businessId || decoded.bizId,
    };

    return { valid: true, decoded: enhancedDecoded, error: null };
        
  } catch (error) {
    console.error("Token verification error:", error.message);
    Sentry.captureException(error);
    return { valid: false, decoded: null, error: "TOKEN_ERROR" };
  }
}

// ✅ Shim so routes can `import { verifyToken } from '@/middleware/auth'`
export async function verifyToken(input) {
  // Request object
  if (input && typeof input === "object" && "headers" in input) {
    return authenticateRequest(input);
  }
  // Raw token string
  if (typeof input === "string" && input.trim()) {
    try {
      const decoded = verifyAccess(input.trim());
      
      // Enhance the decoded token with consistent field names
      const enhancedDecoded = {
        ...decoded,
        userId: decoded.sub || decoded.userId || decoded.id,
        businessId: decoded.businessId || decoded.bizId,
      };
      
      return { valid: true, decoded: enhancedDecoded, error: null };
    } catch (err) {
      Sentry.captureException(err);
      return { valid: false, error: "Invalid or expired token" };
    }
  }
  return { valid: false, error: "Authorization header missing or malformed" };
}

export { getBearer }; // optional, if other code needs it