// apps/backend/src/middleware/auth.js
import * as Sentry from "@sentry/nextjs";
import { verifyAccess } from "../lib/token"; // from your token helper

function getBearer(req) {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const [scheme, token] = h.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

/**
 * Authenticates a Next.js Request using an ACCESS token.
 * Returns { valid, decoded?, error? }
 */
export async function authenticateRequest(req) {
  const token = getBearer(req);
  if (!token) {
    Sentry.addBreadcrumb({
      message: "Authorization header missing or malformed",
      category: "auth",
      level: "warning",
    });
    return { valid: false, error: "Authorization header missing or malformed" };
  }

  try {
    const decoded = verifyAccess(token); // enforces alg/iss/aud/type === "access"
    return { valid: true, decoded };
  } catch (err) {
    const expected =
      err.name === "TokenExpiredError" ||
      err.name === "JsonWebTokenError" ||
      err.name === "NotBeforeError" ||
      /Invalid token type/i.test(err.message);

    if (!expected) {
      Sentry.captureException(err, {
        tags: { module: "auth", where: "authenticateRequest" },
      });
    } else {
      Sentry.addBreadcrumb({
        message: "Access token rejected",
        category: "auth",
        level: "info",
        data: { reason: err.name || err.message },
      });
    }

    return { valid: false, error: "Invalid or expired token" };
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
       return { valid: true, decoded };
     } catch (err) {
       return { valid: false, error: "Invalid or expired token" };
     }
   }
   return { valid: false, error: "Authorization header missing or malformed" };
 }
 
 export { getBearer }; // optional, if other code needs it