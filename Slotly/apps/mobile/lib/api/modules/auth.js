
import api, { setToken, clearToken } from "../../api/client";
import * as SecureStore from "expo-secure-store";

/** ================== Config ================== **/
const REFRESH_KEY = "refreshToken";
const SESSION_STARTED_AT_KEY = "sessionStartedAt";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** ========== SecureStore helpers ========== **/
async function setRefreshToken(token) {
  try { if (token) await SecureStore.setItemAsync(REFRESH_KEY, token); } catch {}
}
async function getRefreshToken() {
  try { return await SecureStore.getItemAsync(REFRESH_KEY); } catch { return null; }
}
async function clearRefreshToken() {
  try { await SecureStore.deleteItemAsync(REFRESH_KEY); } catch {}
}

async function markSessionStart() {
  try { await SecureStore.setItemAsync(SESSION_STARTED_AT_KEY, String(Date.now())); } catch {}
}
export async function isSessionExpiredWeekly() {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_STARTED_AT_KEY);
    if (!raw) return true; // if unknown, treat as expired to be safe
    const startedAt = Number(raw);
    return Number.isFinite(startedAt) && (Date.now() - startedAt) > SESSION_MAX_AGE_MS;
  } catch {
    return true;
  }
}



export async function loginInitiate({ identifier, password }) {
  const payload = password ? { identifier, password } : { identifier };
  const { data } = await api.post("/auth/login", payload);
  return data; // { otpSessionId, expiresIn? }
}

export async function loginVerify({ otpSessionId, code }) {
  const { data } = await api.post("/auth/login/verify", { otpSessionId, code });
  if (data?.accessToken) await setToken(data.accessToken);
  if (data?.refreshToken) await setRefreshToken(data.refreshToken);
  await markSessionStart();
  return data;
}

export async function loginResend({ otpSessionId }) {
  const { data } = await api.post("/auth/login/resend", { otpSessionId });
  return data;
}



export async function signupInitiate({ name, email, phone, password }) {
  const { data } = await api.post("/auth/signup/initiate", {
    name, email, phone, password,
  });
  return data;
}

export async function signupVerify({ otp, otpSessionId, txId }) {
  const id = otpSessionId || txId;
  const { data } = await api.post("/auth/signup/verfiy", {
    otp,
    otpSessionId: id,
    txId: id,
  });
  if (data?.accessToken) await setToken(data.accessToken);
  if (data?.refreshToken) await setRefreshToken(data.refreshToken);
  await markSessionStart();
  return data;
}

export async function signupResend({ otpSessionId, txId }) {
  const id = otpSessionId || txId;
  const { data } = await api.post("/auth/signup/resend", {
    otpSessionId: id,
    txId: id,
  });
  return data;
}

/** ============== Legacy / utilities ============== **/

export async function verifyOTP({ otp }) {
  const { data } = await api.post("/auth/verifyOTP", { otp });
  return data;
}

export async function login({ email, password }) {
  const { data } = await api.post("/auth/login", { email, password });
  if (data?.token) await setToken(data.token);
  if (data?.refreshToken) await setRefreshToken(data.refreshToken);
  await markSessionStart();
  return data;
}

/** ===================== Refresh + Logout ===================== **/

export async function refreshSession() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;
  const { data } = await api.post("/auth/refresh", { refreshToken });
  if (data?.accessToken) await setToken(data.accessToken);
  if (data?.refreshToken) await setRefreshToken(data.refreshToken);
  // refresh counts as renewing the session start time
  await markSessionStart();
  return data;
}

export async function clearSession() {
  await clearToken();
  await clearRefreshToken();
  try { await SecureStore.deleteItemAsync(SESSION_STARTED_AT_KEY); } catch {}
}

export async function logout() {
  try { await api.post("/auth/logout"); } catch {}
  await clearSession();
  return { ok: true };
}
