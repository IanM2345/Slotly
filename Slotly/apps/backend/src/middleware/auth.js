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
  try {
    // Try to get token from different sources
    let token = null;
    
    // 1. Try Authorization header (Bearer token)
    const authHeader = req.headers.get?.("authorization") || req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }
    
    // 2. Try cookies (for web sessions)
    if (!token) {
      const cookies = req.headers.get?.("cookie") || req.headers.cookie;
      if (cookies) {
        const cookieMatch = cookies.match(/access_token=([^;]+)/);
        if (cookieMatch) {
          token = cookieMatch[1];
        }
      }
    }
    
    if (!token) {
      return { valid: false, decoded: null, error: "NO_TOKEN" };
    }
    
    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
      clockTolerance: 5,
    });
    
    // Check token type
    if (decoded.type !== "access") {
      return { valid: false, decoded: null, error: "INVALID_TOKEN_TYPE" };
    }
    
    if (!decoded.sub) {
      return { valid: false, decoded: null, error: "MISSING_SUBJECT" };
    }
    
    return { valid: true, decoded, error: null };
    
  } catch (error) {
    console.error("Token verification error:", error.message);
    
    // Handle specific JWT errors
    if (error.name === 'TokenExpiredError') {
      return { valid: false, decoded: null, error: "EXPIRED_TOKEN" };
    } else if (error.name === 'JsonWebTokenError') {
      return { valid: false, decoded: null, error: "INVALID_TOKEN" };
    } else if (error.name === 'NotBeforeError') {
      return { valid: false, decoded: null, error: "TOKEN_NOT_ACTIVE" };
    }
    
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
       return { valid: true, decoded };
     } catch (err) {
       return { valid: false, error: "Invalid or expired token" };
     }
   }
   return { valid: false, error: "Authorization header missing or malformed" };
 }
 
 export { getBearer }; // optional, if other code needs it