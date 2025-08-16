// apps/mobile/lib/api/modules/staff.js
//
// Frontend client for Slotly Staff APIs.
// Requires a Bearer token (put your JWT in `authToken` arg).
//
// Endpoints covered:
//  - POST   /api/staff/apply
//  - GET    /api/staff/availability
//  - POST   /api/staff/availability
//  - DELETE /api/staff/availability?id=...
//  - GET    /api/staff/me
//  - GET    /api/staff/performance
//  - GET    /api/staff/schedule?upcoming=&date=&status=
//  - GET    /api/staff/timeoff
//  - POST   /api/staff/timeoff
//  - DELETE /api/staff/timeoff?id=...

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  ''; // e.g. "https://api.slotly.example.com"

const DEFAULT_TIMEOUT_MS = 20_000;

function assertBase() {
  if (!API_BASE_URL) {
    throw new Error('API_BASE_URL is not set. Configure EXPO_PUBLIC_API_BASE_URL or API_BASE_URL.');
  }
}

function qs(params = {}) {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ''
  );
  return entries.length ? `?${new URLSearchParams(Object.fromEntries(entries)).toString()}` : '';
}

async function http(path, { method = 'GET', token, body, timeout = DEFAULT_TIMEOUT_MS } = {}) {
  assertBase();

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });

    const text = await res.text();
    const isJson = res.headers.get('content-type')?.includes('application/json');
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

/* =========================
 * /api/staff/apply
 * (role: CUSTOMER; fields: businessId, idNumber, idPhotoUrl, selfieWithIdUrl)
 * Backend: apps/backend/src/app/api/staff/apply/route.js
 * ========================= */
export async function applyToBusiness({ token, businessId, idNumber, idPhotoUrl, selfieWithIdUrl }) {
  if (!token) throw new Error('auth token required');
  if (!businessId || !idNumber || !idPhotoUrl || !selfieWithIdUrl) {
    throw new Error('businessId, idNumber, idPhotoUrl, selfieWithIdUrl are required');
  }
  return http('/api/staff/apply', {
    method: 'POST',
    token,
    body: { businessId, idNumber, idPhotoUrl, selfieWithIdUrl },
  });
}

/* =========================
 * /api/staff/availability
 * GET: list slots; POST: create slot; DELETE: delete by ?id
 * Backend: apps/backend/src/app/api/staff/availability/route.js
 * ========================= */
export async function getAvailability({ token }) {
  if (!token) throw new Error('auth token required');
  return http('/api/staff/availability', { method: 'GET', token });
}

export async function createAvailabilitySlot({ token, startTime, endTime }) {
  if (!token) throw new Error('auth token required');
  if (!startTime || !endTime) throw new Error('startTime and endTime are required');
  return http('/api/staff/availability', {
    method: 'POST',
    token,
    body: { startTime, endTime },
  });
}

export async function deleteAvailabilitySlot({ token, id }) {
  if (!token) throw new Error('auth token required');
  if (!id) throw new Error('id is required');
  return http(`/api/staff/availability${qs({ id })}`, { method: 'DELETE', token });
}

/* =========================
 * /api/staff/me
 * GET: staff profile (role must be STAFF)
 * Backend: apps/backend/src/app/api/staff/me/route.js
 * ========================= */
export async function getStaffProfile({ token }) {
  if (!token) throw new Error('auth token required');
  return http('/api/staff/me', { method: 'GET', token });
}

/* =========================
 * /api/staff/performance
 * GET: metrics (bookings, revenue, rating, etc.)
 * Backend: apps/backend/src/app/api/staff/performance/route.js
 * ========================= */
export async function getStaffPerformance({ token }) {
  if (!token) throw new Error('auth token required');
  return http('/api/staff/performance', { method: 'GET', token });
}

/* =========================
 * /api/staff/schedule
 * GET: bookings; query: upcoming=true|false, date=YYYY-MM-DD, status=...
 * Backend: apps/backend/src/app/api/staff/schedule/route.js
 * ========================= */
export async function getStaffSchedule({
  token,
  upcoming,  // boolean
  date,      // YYYY-MM-DD
  status,    // e.g., 'CONFIRMED' | 'CANCELLED' etc.
} = {}) {
  if (!token) throw new Error('auth token required');
  const query = qs({
    upcoming: typeof upcoming === 'boolean' ? String(upcoming) : undefined,
    date,
    status,
  });
  return http(`/api/staff/schedule${query}`, { method: 'GET', token });
}

/* =========================
 * /api/staff/timeoff
 * GET: list; POST: request; DELETE: cancel by ?id (only if PENDING)
 * Backend: apps/backend/src/app/api/staff/timeoff/route.js
 * ========================= */
export async function getTimeOffRequests({ token }) {
  if (!token) throw new Error('auth token required');
  return http('/api/staff/timeoff', { method: 'GET', token });
}

export async function requestTimeOff({ token, startDate, endDate, reason }) {
  if (!token) throw new Error('auth token required');
  if (!startDate || !endDate) throw new Error('startDate and endDate are required');
  return http('/api/staff/timeoff', {
    method: 'POST',
    token,
    body: { startDate, endDate, reason },
  });
}

export async function cancelTimeOff({ token, id }) {
  if (!token) throw new Error('auth token required');
  if (!id) throw new Error('id is required');
  return http(`/api/staff/timeoff${qs({ id })}`, { method: 'DELETE', token });
}
