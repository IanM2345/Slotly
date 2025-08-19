// apps/mobile/lib/api/modules/auth.js
import api from "../../api/client";             // axios instance
import { storage } from "../../utilis/storage"; // your storage wrapper

/** ================== Config ================== **/
const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_KEY = "refreshToken";
const SESSION_STARTED_AT_KEY = "sessionStartedAt";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** ========== Storage helpers ========== **/
async function setAccessToken(token) {
  try {
    if (token) {
      await storage.setItem(ACCESS_TOKEN_KEY, token);
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
    }
  } catch {}
}
async function clearAccessToken() {
  try {
    await storage.removeItem(ACCESS_TOKEN_KEY);
    delete api.defaults.headers.common.Authorization;
  } catch {}
}
async function setRefreshToken(token) {
  try { if (token) await storage.setItem(REFRESH_KEY, token); } catch {}
}
async function getRefreshToken() {
  try { return await storage.getItem(REFRESH_KEY); } catch { return null; }
}
async function clearRefreshToken() {
  try { await storage.removeItem(REFRESH_KEY); } catch {}
}
async function markSessionStart() {
  try { await storage.setItem(SESSION_STARTED_AT_KEY, String(Date.now())); } catch {}
}
export async function isSessionExpiredWeekly() {
  try {
    const raw = await storage.getItem(SESSION_STARTED_AT_KEY);
    if (!raw) return true;
    const startedAt = Number(raw);
    return Number.isFinite(startedAt) && (Date.now() - startedAt) > SESSION_MAX_AGE_MS;
  } catch { return true; }
}

/** ================== Auth flows ================== **/

// Sign up (initiate)
export async function signupInitiate({ firstName, lastName, email, phone, password }) {
  const name = `${firstName} ${lastName}`.trim();
  const { data } = await api.post("/api/auth/signup/initiate", { name, email, phone, password });
  return data; // { sessionData, message, ... }
}

// Sign up (verify OTP) — NOW auto-login on success
export async function signupVerify(payload) {
  const required = ["name", "password", "otp", "otpExpires", "otpEntered"];
  const missing = required.filter((k) => {
    const v = payload?.[k];
    return v == null || (typeof v === "string" && v.trim() === "");
  });
  if (missing.length) throw new Error(`Missing required fields: ${missing.join(", ")}`);

  const requestPayload = {
    name: payload.name,
    email: payload.email || null,
    phone: payload.phone || null,
    password: payload.password,     // hashed from initiate
    otp: payload.otp,               // hashed from initiate
    otpEntered: payload.otpEntered, // user input
    otpExpires: payload.otpExpires, // ISO string
    referralCode: payload.referralCode || null,
  };

  const { data } = await api.post("/api/auth/signup/verfiy", requestPayload); // keep backend path typo

  // ⬇️ Auto-login if backend returns tokens
  if (data?.token) await setAccessToken(data.token);
  if (data?.refreshToken) await setRefreshToken(data.refreshToken);
  if (data?.token || data?.refreshToken) await markSessionStart();

  return data; // { token, refreshToken, user, ... } (shape depends on your backend)
}

// Login
export async function login({ email, password }) {
  const { data } = await api.post("/api/auth/login", { email, password });
  if (data?.token) await setAccessToken(data.token);
  if (data?.refreshToken) await setRefreshToken(data.refreshToken);
  await markSessionStart();
  return data;
}

// Logout
export async function logout() {
  try { await api.post("/api/auth/logout"); } catch {}
  await clearAccessToken();
  await clearRefreshToken();
  try { await storage.removeItem(SESSION_STARTED_AT_KEY); } catch {}
  return { ok: true };
}

/** ============== Utilities ============== **/
export async function verifyOTP({ otp }) {
  const { data } = await api.post("/api/auth/verifyOTP", { otp });
  return data;
}

/** ===================== Refresh + Logout ===================== **/
export async function refreshSession() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;
  const { data } = await api.post("/api/auth/refresh", { refreshToken });
  if (data?.accessToken) await setAccessToken(data.accessToken);
  if (data?.refreshToken) await setRefreshToken(data.refreshToken);
  await markSessionStart();
  return data;
}

export async function clearSession() {
  await clearAccessToken();
  await clearRefreshToken();
  try { await storage.removeItem(SESSION_STARTED_AT_KEY); } catch {}
}

export async function logoutFull() {
  try { await api.post("/api/auth/logout"); } catch {}
  await clearSession();
  return { ok: true };
}
