// apps/backend/src/lib/token.js
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { authenticateRequest } from "@/middleware/auth"; // ✅ add this

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET missing or too short (min 32 chars).");
}

const ISSUER = process.env.JWT_ISSUER || "your-app";
const AUDIENCE = process.env.JWT_AUDIENCE || "your-app-clients";

const ACCESS_EXPIRES = process.env.ACCESS_TTL || "15m";
const REFRESH_EXPIRES = process.env.REFRESH_TTL || "30d";

export function signAccessToken(user) {
  const payload = { sub: user.id, email: user.email, role: user.role, type: "access" };
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_EXPIRES,
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithm: "HS256",
  });
}

export function signRefreshToken(user, jti) {
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = { sub: user.id, jti, type: "refresh", nbf: nowSec - 5 };
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: REFRESH_EXPIRES,
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithm: "HS256",
  });
}

// ✅ legacy helper used by routes
export async function requireAuth(req) {
  const { valid, decoded } = await authenticateRequest(req);
  if (!valid) return null;
  // normalize to what routes expect
  return {
    id: decoded.sub ?? decoded.id ?? null,
    role: decoded.role,
    email: decoded.email,
  };
}

export function verifyAccess(token) {
  const decoded = jwt.verify(token, JWT_SECRET, {
    algorithms: ["HS256"],
    issuer: ISSUER,
    audience: AUDIENCE,
    clockTolerance: 5,
  });
  if (decoded.type !== "access") throw new Error("Invalid token type");
  if (!decoded.sub) throw new Error("Missing subject");
  return decoded;
}

export function verifyRefresh(token) {
  const decoded = jwt.verify(token, JWT_SECRET, {
    algorithms: ["HS256"],
    issuer: ISSUER,
    audience: AUDIENCE,
    clockTolerance: 5,
  });
  if (decoded.type !== "refresh") throw new Error("Invalid token type");
  if (!decoded.sub || !decoded.jti) throw new Error("Invalid refresh payload");
  return decoded;
}

export function newJti() {
  return crypto.randomUUID?.() || crypto.randomBytes(16).toString("hex");
}
export const verifyToken = verifyAccess;
