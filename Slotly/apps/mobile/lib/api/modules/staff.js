// apps/mobile/lib/api/modules/staff.js
//
// Frontend client for Slotly Staff APIs (business-scoped).
// Adds ?businessId=... to all requests when provided.
// Returns safe defaults ([], 0) when backend fields are missing.

import Constants from "expo-constants";
// If you have a shared client that stores tokens (recommended), expose getTokens() from it:
import { getTokens } from "../client"; // <- adjust path if your client lives elsewhere

const API_BASE =
  Constants.expoConfig?.extra?.apiBaseUrl ||
  process.env.EXPO_PUBLIC_API_BASE ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  "";

const DEFAULT_TIMEOUT_MS = 20_000;

function assertBase() {
  if (!API_BASE) {
    throw new Error(
      "API_BASE is not set. Configure expo.extra.apiBaseUrl or EXPO_PUBLIC_API_BASE(_URL) or API_BASE_URL."
    );
  }
}

function qs(params = {}) {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ""
  );
  return entries.length
    ? `?${new URLSearchParams(Object.fromEntries(entries)).toString()}`
    : "";
}

async function withAuthHeader(token) {
  if (token) return { Authorization: `Bearer ${token}` };
  try {
    const tks = await getTokens?.();
    if (tks?.accessToken) return { Authorization: `Bearer ${tks.accessToken}` };
  } catch {}
  return {};
}

async function http(
  path,
  { method = "GET", token, body, timeout = DEFAULT_TIMEOUT_MS, headers = {} } = {}
) {
  assertBase();

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);

  try {
    const auth = await withAuthHeader(token);

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...auth,
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });

    const text = await res.text();
    const isJson = res.headers.get("content-type")?.includes("application/json");
    const data = isJson && text ? JSON.parse(text) : text;

    if (!res.ok) {
      const msg = (data && data.error) || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(t);
  }
}

// ================== Staff Performance Metrics ==================
export async function staffPerformance({ token, businessId } = {}) {
  const q = qs({ businessId });
  const json = await http(`/api/staff/performance${q}`, { method: "GET", token });

  const m = json?.metrics || {};
  return {
    // headline cards
    completedBookings: Number(m.completedBookings || 0),
    cancellations: Number(m.cancelledBookings || 0),
    averageRating: Number(m.averageRating ?? 0),
    commissionEarned: Number(m.commissionEarned || 0),

    // extras (you may use elsewhere)
    totalBookings: Number(m.totalBookings || 0),
    totalRevenue: Number(m.totalRevenue || 0),
    performanceScore: Number(m.performanceScore || 0),

    // charts
    series: m.series || {
      bookings: [],      // [{ x: "2025-01", y: 12 }, ...]
      earnings: [],
      cancellations: [],
    },
    monthlyStats: m.monthlyStats || {},
    topServices: Array.isArray(m.topServices) ? m.topServices : [],
  };
}

// ================== Staff Profile ==================
/**
 * Get staff profile with business context
 * @param {Object} options
 * @param {string} [options.token] - JWT token (optional; auto-fetched if omitted)
 * @param {string} [options.businessId] - Optional business ID for scoping
 */
export async function staffMe({ token, businessId } = {}) {
  const query = qs({ businessId });
  const json = await http(`/api/staff/me${query}`, { method: "GET", token });

  return {
    user: json?.user || json?.staff || null,
    activeBusiness: json?.activeBusiness || null,
    businesses: Array.isArray(json?.businesses) ? json.businesses : [],
    ...json,
  };
}

// ================== Staff Application ==================
/**
 * Apply to become staff at a business
 * NOTE: Ensure you have a backend route at /api/staff/apply (not included in Step 2).
 */
export async function applyToBusiness({
  token,
  businessId,
  idNumber,
  idPhotoUrl,
  selfieWithIdUrl,
}) {
  if (!businessId || !idNumber || !idPhotoUrl || !selfieWithIdUrl) {
    throw new Error("businessId, idNumber, idPhotoUrl, selfieWithIdUrl are required");
  }

  return await http("/api/staff/apply", {
    method: "POST",
    token,
    body: { businessId, idNumber, idPhotoUrl, selfieWithIdUrl },
  });
}

// ================== Availability Management ==================
export const staffAvailability = {
  async list({ token, businessId } = {}) {
    const q = qs({ businessId });
    const json = await http(`/api/staff/availability${q}`, { method: "GET", token });
    return Array.isArray(json?.availability) ? json.availability : [];
  },

  /**
   * Create availability slot(s)
   * Accepts either { slots: [...] } or a single { startTime, endTime }.
   */
  async create({ token, businessId, slots, startTime, endTime }) {
    let slotData;
    if (slots) {
      slotData = { slots: Array.isArray(slots) ? slots : [slots] };
    } else if (startTime && endTime) {
      slotData = { slots: [{ startTime, endTime }] };
    } else {
      throw new Error("Either 'slots' or 'startTime + endTime' are required");
    }

    const q = qs({ businessId });
    return await http(`/api/staff/availability${q}`, {
      method: "POST",
      token,
      body: slotData,
    });
  },

  async remove({ token, businessId, id }) {
    if (!id) throw new Error("id is required");
    const q = qs({ businessId, id });
    return await http(`/api/staff/availability${q}`, { method: "DELETE", token });
  },
};

// ================== Time-off Management ==================
export const staffTimeoff = {
  async list({ token, businessId } = {}) {
    const q = qs({ businessId });
    const json = await http(`/api/staff/timeoff${q}`, { method: "GET", token });
    return Array.isArray(json?.requests || json?.timeOffRequests)
      ? json.requests || json.timeOffRequests
      : [];
  },

  async create({ token, businessId, startDate, endDate, reason }) {
    if (!startDate || !endDate) throw new Error("startDate and endDate are required");
    const q = qs({ businessId });
    return await http(`/api/staff/timeoff${q}`, {
      method: "POST",
      token,
      body: { startDate, endDate, reason },
    });
  },

  async cancel({ token, businessId, id }) {
    if (!id) throw new Error("id is required");
    const q = qs({ businessId, id });
    return await http(`/api/staff/timeoff${q}`, { method: "DELETE", token });
  },
};

// ================== Schedule Management ==================
/**
 * Get staff schedule/bookings
 * @param {Object} options
 * @param {string} [options.token] - JWT token (optional)
 * @param {string} [options.businessId]
 * @param {boolean} [options.upcoming]
 * @param {string} [options.date] - YYYY-MM-DD
 * @param {string} [options.status]
 * @param {string} [options.serviceId] - Filter by specific service
 */
export async function staffSchedule({
  token,
  businessId,
  upcoming,
  date,
  status,
  serviceId,
} = {}) {
  const q = qs({
    businessId,
    upcoming: typeof upcoming === "boolean" ? String(upcoming) : undefined,
    date,
    status,
    serviceId,
  });

  const json = await http(`/api/staff/schedule${q}`, { method: "GET", token });
  return Array.isArray(json?.bookings) ? json.bookings : [];
}

// ================== Mark Booking Status ==================
/**
 * Mark a booking completed or no-show
 * @param {Object} options
 * @param {string} options.id - Booking ID
 * @param {string} options.action - "complete" | "no_show"
 * @param {string} [options.token] - JWT token (optional)
 * @param {string} [options.businessId] - Business ID for scoping
 */
export async function markBooking({ id, action, token, businessId }) {
  if (!id || !action) throw new Error("id and action are required");
  const q = qs({ id, businessId });
  return await http(`/api/staff/bookings${q}`, {
    method: "PATCH",
    token,
    body: { action }, // "complete" | "no_show"
  });
}

// ================== Staff Assigned Services ==================
export async function staffAssignedServices({ token, businessId } = {}) {
  const q = qs({ businessId });
  const json = await http(`/api/staff/services${q}`, { method: "GET", token });
  return Array.isArray(json?.services) ? json.services : [];
}

// ================== Profile (used by profile.tsx) ==================
export async function getProfile({ token, businessId } = {}) {
  const q = qs({ businessId });
  const json = await http(`/api/users/me${q}`, { method: "GET", token });
  return {
    id: json?.id ?? "",
    firstName: json?.firstName ?? "",
    lastName: json?.lastName ?? "",
    email: json?.email ?? "",
    phone: json?.phone ?? "",
    avatarUri: json?.avatarUri ?? null,
  };
}

export async function updateProfile(profile, { token, businessId } = {}) {
  const q = qs({ businessId });
  await http(`/api/users/me${q}`, { method: "PUT", token, body: profile });
}

export async function changePassword(payload, { token, businessId } = {}) {
  const q = qs({ businessId });
  await http(`/api/auth/change-password${q}`, { method: "POST", token, body: payload });
}

// ================== Notifications (used by notifications.tsx) ==================
export async function getNotifications({ token, businessId } = {}) {
  const q = qs({ businessId });
  const json = await http(`/api/staff/notifications${q}`, { method: "GET", token });
  // backend may return { notifications: [...] } or bare array
  return Array.isArray(json?.notifications) ? json.notifications : (Array.isArray(json) ? json : []);
}

export async function markNotificationRead(id, { token, businessId } = {}) {
  if (!id) throw new Error("id required");
  const q = qs({ id, businessId });
  await http(`/api/staff/notifications${q}`, { method: "PUT", token, body: { read: true } });
}

export async function markAllRead({ token, businessId } = {}) {
  const q = qs({ businessId });
  await http(`/api/staff/notifications${q}`, { method: "PUT", token, body: { readAll: true } });
}

// ================== saveAvailability helper used by availability.tsx ==================
export async function saveAvailability(availability, { token, businessId } = {}) {
  // accept array or object map; just pass through as slots
  const slots = Array.isArray(availability) ? availability : availability?.slots ?? availability;
  const q = qs({ businessId });
  await http(`/api/staff/availability${q}`, { method: "POST", token, body: { slots: Array.isArray(slots) ? slots : [slots] } });
}

// ================== ENHANCED AGGREGATOR FOR SCREENS ==================
export const staffApi = {
  // what your screen calls first
  getStaffMe: (opts) => staffMe(opts),

  // your screen sets `profile` from this call; return just the user shape for convenience
  getProfile: async (opts) => {
    const res = await staffMe(opts);
    return res?.user ?? res ?? null;
  },

  // Update profile
  updateProfile,
  changePassword,

  // naming matches your screen
  getPerformanceMetrics: (opts) => staffPerformance(opts),

  getSchedule: (opts) => staffSchedule(opts),

  // NEW - Mark booking status
  markBooking: (opts) => markBooking(opts),

  // if you don't have a /api/staff/notifications route yet,
  // this returns [] safely (so the screen never hangs)
  getNotifications: async ({ token, businessId } = {}) => {
    try {
      const q = qs({ businessId });
      const json = await http(`/api/staff/notifications${q}`, { method: "GET", token });
      return Array.isArray(json?.notifications || json?.items)
        ? (json.notifications || json.items)
        : [];
    } catch {
      return [];
    }
  },

  // NEW - Assigned services
  getAssignedServices: (opts) => staffAssignedServices(opts),

  // Bookings by status - convenience wrapper
  getBookingsByStatus: ({ businessId, status, serviceId } = {}) =>
    staffSchedule({
      businessId,
      status,          // "CONFIRMED" | "CANCELLED" | "NO_SHOW" | "COMPLETED" | "PENDING"
      ...(status === "UPCOMING" ? { upcoming: true } : {}),
      ...(serviceId ? { serviceId } : {}),
    }),

  // availability & time off
  getAvailability: ({ token, businessId } = {}) => staffAvailability.list({ token, businessId }),
  saveAvailability: (availability, { token, businessId } = {}) =>
    saveAvailability(availability, { token, businessId }),
  getTimeOffRequests: ({ token, businessId } = {}) => staffTimeoff.list({ token, businessId }),
  requestTimeOff: (timeOffData, { token, businessId } = {}) =>
    staffTimeoff.create({ 
      token, 
      businessId, 
      startDate: timeOffData.fromDate, 
      endDate: timeOffData.toDate, 
      reason: timeOffData.reason 
    }),

  // notifications
  markNotificationRead: (id, { token, businessId } = {}) =>
    markNotificationRead(id, { token, businessId }),
  markAllRead: ({ token, businessId } = {}) => markAllRead({ token, businessId }),
};

// ================== Legacy Compatibility ==================
export async function getStaffProfile({ token, businessId } = {}) {
  return await staffMe({ token, businessId });
}

export async function getAvailability({ token, businessId } = {}) {
  return await staffAvailability.list({ token, businessId });
}

export async function createAvailabilitySlot({
  token,
  businessId,
  startTime,
  endTime,
}) {
  return await staffAvailability.create({ token, businessId, startTime, endTime });
}

export async function deleteAvailabilitySlot({ token, businessId, id }) {
  return await staffAvailability.remove({ token, businessId, id });
}

export async function getTimeOffRequests({ token, businessId } = {}) {
  return await staffTimeoff.list({ token, businessId });
}

export async function requestTimeOff({
  token,
  businessId,
  startDate,
  endDate,
  reason,
}) {
  return await staffTimeoff.create({ token, businessId, startDate, endDate, reason });
}

export async function cancelTimeOff({ token, businessId, id }) {
  return await staffTimeoff.cancel({ token, businessId, id });
}

export async function getStaffSchedule({
  token,
  businessId,
  upcoming,
  date,
  status,
} = {}) {
  return await staffSchedule({ token, businessId, upcoming, date, status });
}

export async function getStaffPerformance({ token, businessId } = {}) {
  return await staffPerformance({ token, businessId });
}