// apps/mobile/lib/api/modules/manager.js
import api from "../client";

/* --------------------------- Analytics --------------------------- */
/**
 * GET /api/manager/analytics
 * Supports both legacy and new API patterns:
 *  - Legacy: getAnalytics({ view, startDate, endDate, metrics })
 *  - New: getAnalytics(token, { period: "30d", tz: "Africa/Nairobi" })
 */
export async function getAnalytics(arg1, arg2) {
  const isNewSignature = typeof arg1 === "string" || (arg2 && typeof arg2 === "object");
  
  if (isNewSignature) {
    // New signature: getAnalytics(token, { period, tz })
    const token = typeof arg1 === "string" ? arg1 : undefined;
    const { period = "30d", tz } = arg2 || {};
    const params = {};
    if (period) params.period = period;
    if (tz) params.tz = tz;
    
    const res = await api.get("/api/manager/analytics", {
      params,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return res.data; // { analytics, meta, kpis, series }
  }
  
  // Legacy signature: getAnalytics(params)
  const params = arg1 || {};
  const isCsv = params?.export === "csv";
  const res = await api.get("/api/manager/analytics", {
    params,
    ...(isCsv ? { responseType: "arraybuffer" } : {}),
  });
  return res.data;
}

export async function getAnalyticsCsv(params = {}) {
  const resp = await api.get("/api/manager/analytics", {
    params: { ...params, export: "csv" }, // backend expects export=csv
    responseType: "text",                 // get CSV as text for easy saving
    headers: { Accept: "text/csv" },
  });
  return resp.data; // CSV string
}

/** Get current owner's business profile (address, hours, etc.) */
export async function getBusinessProfile() {
  const { data } = await api.get("/api/manager/me");
  return data;
}

/** Update address/coords/hours for the current owner's business */
export async function updateBusinessProfile(payload) {
  const { data } = await api.put("/api/manager/me", payload);
  // backend returns { message, business }
  return data.business ?? data;
}

/* ---------------------------- Reports ---------------------------- */
/** GET /api/manager/reports */
export async function listReports(params) {
  const { data } = await api.get("/api/manager/reports", { params });
  return data;
}

/** GET /api/manager/reports/[id] → PDF bytes */
export async function previewReport({ reportId }) {
  const res = await api.get(`/api/manager/reports/${reportId}`, {
    responseType: "arraybuffer",
  });
  return res.data; // PDF bytes
}

/** GET /api/manager/reports?empty=1 → blank PDF bytes (plan-gated) */
export async function downloadEmptyReport() {
  const res = await api.get(`/api/manager/reports`, {
    params: { empty: 1 },
    responseType: "arraybuffer",
    headers: { Accept: "application/pdf" },
  });
  return res.data;
}

/* ---------------------------- Bookings --------------------------- */
/** GET /api/manager/bookings?staffId=&serviceId=&date= */
export async function listBookings(params) {
  const { data } = await api.get("/api/manager/bookings", { params });
  return data.bookings;
}

/** PATCH /api/manager/bookings { action: 'reassign', id, staffId } */
export async function reassignBookingStaff({ id, staffId }) {
  const { data } = await api.patch("/api/manager/bookings", { action: "reassign", id, staffId });
  return data; // { message, booking }
}

/** PATCH /api/manager/bookings { action: 'reschedule', id, startTime } */
export async function rescheduleBooking({ id, startTime }) {
  const { data } = await api.patch("/api/manager/bookings", { action: "reschedule", id, startTime });
  return data; // { message, booking }
}

/** PATCH /api/manager/bookings { action: 'cancel', id, reason? } */
export async function cancelManagerBooking({ id, reason }) {
  const { data } = await api.patch("/api/manager/bookings", { action: "cancel", id, reason });
  return data; // { message, booking }
}

/** PATCH /api/manager/bookings { action: 'complete', id } */
export async function markBookingCompleted({ id }) {
  const { data } = await api.patch("/api/manager/bookings", { action: "complete", id });
  return data;
}

/** PATCH /api/manager/bookings { action: 'noShow', id } */
export async function markBookingNoShow({ id }) {
  const { data } = await api.patch("/api/manager/bookings", { action: "noShow", id });
  return data;
}

/* ----------------------------- Bundles --------------------------- */
/** GET /api/manager/bundles - FIXED: normalizes response and maps bundleServices to services */
export async function listBundles() {
  const res = await api.get("/api/manager/bundles");
  const payload = res?.data?.bundles ?? res?.data ?? [];

  const arr = Array.isArray(payload) ? payload : [];
  return arr.map((b) => ({
    id: b.id,
    name: b.name,
    price: b.price ?? 0,
    duration: b.duration ?? 0,
    businessId: b.businessId,
    description: b.description ?? null,
    // server includes `bundleServices`, but the screen expects `services`
    services: (b.bundleServices ?? b.services ?? []).map((bs) => ({
      service: {
        id: bs?.service?.id,
        name: bs?.service?.name ?? '',
      },
    })),
  }));
}

/** POST /api/manager/bundles */
export async function createBundle(payload) {
  const { data } = await api.post("/api/manager/bundles", payload);
  return data; // created bundle
}

/** DELETE /api/manager/bundles?id= */
export async function deleteBundle(id) {
  const { data } = await api.delete("/api/manager/bundles", { params: { id } });
  return data; // { message }
}

/* ----------------------------- Coupons --------------------------- */
/** GET /api/manager/coupons?active=&expired=&used= */
export async function listCoupons(params) {
  const { data } = await api.get("/api/manager/coupons", { params });
  return data.coupons;
}

/** POST /api/manager/coupons */
export async function createCoupon(payload) {
  const { data } = await api.post("/api/manager/coupons", payload);
  return data; // created coupon
}

/** DELETE /api/manager/coupons?id= */
export async function deleteCoupon(id) {
  const { data } = await api.delete("/api/manager/coupons", { params: { id } });
  return data; // { message }
}

/* ------------------------------- Me ------------------------------ */
/** GET /api/manager/me */
export async function getMe() {
  const { data } = await api.get("/api/manager/me");
  return data; // business object
}

/** PUT /api/manager/me */
export async function updateMe(payload) {
  const { data } = await api.put("/api/manager/me", payload);
  return data; // { message, business }
}

/* --------------------------- Performance ------------------------- */
/** GET /api/manager/performance?start=&end= */
export async function getPerformance(params) {
  const { data } = await api.get("/api/manager/performance", { params });
  return data;
}

/* ----------------------------- Reviews --------------------------- */
/** GET /api/manager/reviews */
export async function listReviews() {
  const { data } = await api.get("/api/manager/reviews");
  return data.reviews;
}

/** PATCH /api/manager/reviews?id= */
export async function flagReview(id) {
  const { data } = await api.patch("/api/manager/reviews", null, {
    params: { id },
  });
  return data; // { message, review }
}

/* ----------------------------- Services -------------------------- */
/** POST /api/manager/services */
export async function createService(payload) {
  const { data } = await api.post("/api/manager/services", payload);
  return data;
}

/** PUT /api/manager/services */
export async function updateService(payload) {
  const { data } = await api.put("/api/manager/services", payload);
  return data;
}

/** DELETE /api/manager/services?id= */
export async function deleteService(id) {
  const { data } = await api.delete("/api/manager/services", { params: { id } });
  return data;
}

/** PATCH /api/manager/services { id, available } */
export async function toggleServiceAvailability({ id, available }) {
  const { data } = await api.patch("/api/manager/services", { id, available });
  return data;
}

/** GET /api/manager/services - FIXED: uses manager route, returns plain array */
export async function listServices(params) {
  const { data } = await api.get("/api/manager/services", { params });
  return data; // plain array from the manager route
}

/* ---------------------- Services → Staff lists -------------------- */
/** GET /api/manager/services/staff */
export async function listStaffByServiceAssignment() {
  const { data } = await api.get("/api/manager/services/staff");
  return data; // { assigned, unassigned } (per backend)
}

/* ---------------- Services → Staff assign/unassign ---------------- */
/** POST /api/manager/services/staff/assign { serviceId, staffId } */
export async function assignStaffToService({ serviceId, staffId }) {
  const { data } = await api.post("/api/manager/services/staff/assign", {
    serviceId,
    staffId,
  });
  return data; // { message }
}

/** DELETE /api/manager/services/staff/unassign with JSON body */
export async function unassignStaffFromService({ serviceId, staffId }) {
  // axios supports a request body on DELETE via `data`
  const { data } = await api.delete("/api/manager/services/staff/unassign", {
    data: { serviceId, staffId },
  });
  return data; // { message }
}

// ✅ FIXED: Always pass businessId to these functions
export async function getBookings(businessId, params = {}) {
  return listBookings({ businessId, ...params });
}

// Back-compat aliases for older screens
export const getStaff = async () => {
  const data = await listStaff();
  // listStaff() currently returns { approvedStaff, pendingEnrollments }
  return data.approvedStaff ?? data;    // keep old callers happy
};

export async function setStaffServices({ staffId, desiredServiceIds }) {
  const byService = await listStaffByServiceAssignment(); // { assigned, unassigned }

  const currentlyAssignedByService = new Map();
  for (const item of byService.assigned ?? []) {
    currentlyAssignedByService.set(item.serviceId, new Set(item.staff?.map(s => s.id) || []));
  }

  const allServiceIds = new Set([
    ...(byService.assigned?.map(s => s.serviceId) || []),
    ...(byService.unassigned?.map(s => s.serviceId) || []),
  ]);

  const desired = new Set(desiredServiceIds);
  const ops = [];

  for (const serviceId of allServiceIds) {
    const currentSet = currentlyAssignedByService.get(serviceId) || new Set();
    const isAssigned = currentSet.has(staffId);
    const shouldBeAssigned = desired.has(serviceId);

    if (!isAssigned && shouldBeAssigned) {
      ops.push(assignStaffToService({ serviceId, staffId }));
    } else if (isAssigned && !shouldBeAssigned) {
      ops.push(unassignStaffFromService({ serviceId, staffId }));
    }
  }

  if (ops.length) await Promise.all(ops);
  return { message: "Services updated" };
}

/* ------------------------------ Staff ---------------------------- */
/** GET /api/manager/staff?businessId= */
export async function listStaff(businessId) {
  const params = {};
  if (businessId) params.businessId = businessId;
  
  const { data } = await api.get("/api/manager/staff", { params });
  return data; // { approvedStaff, pendingEnrollments } (per backend)
}

/** POST /api/manager/staff { userId, firstName?, lastName?, businessId? } → direct add (role=STAFF + enrollment APPROVED) */
export async function addStaffDirect({ userId, firstName, lastName, businessId }) {
  const payload = { userId, approveNow: true };
  if (firstName) payload.firstName = firstName;
  if (lastName) payload.lastName = lastName;
  if (businessId) payload.businessId = businessId;
  
  const { data } = await api.post("/api/manager/staff", payload);
  return data; // { message, staff, businessId }
}

/** POST /api/manager/staff { userId, firstName?, lastName?, businessId? } → create PENDING enrollment */
export async function addStaffEnrollment({ userId, firstName, lastName, businessId }) {
  const payload = { userId, approveNow: false };
  if (firstName) payload.firstName = firstName;
  if (lastName) payload.lastName = lastName;
  if (businessId) payload.businessId = businessId;
  
  const { data } = await api.post("/api/manager/staff", payload);
  return data; // { message: 'Enrollment submitted', enrollment: {...} }
}

/** PUT /api/manager/staff { enrollmentId, status } */
export async function reviewStaffEnrollment({ enrollmentId, status }) {
  const { data } = await api.put("/api/manager/staff", { enrollmentId, status });
  return data; // { message, enrollment }
}

/** DELETE /api/manager/staff?id=&businessId= */
export async function removeStaff(id, businessId) {
  const params = { id };
  if (businessId) params.businessId = businessId;
  
  const { data } = await api.delete("/api/manager/staff", { params });
  return data; // { message, removedStaff }
}

/* --------------------------- Subscription ------------------------ */
/** GET /api/manager/subscription */
export async function getSubscription() {
  const { data } = await api.get("/api/manager/subscription");
  return data; // subscription info
}

/** POST /api/manager/subscription */
export async function createSubscriptionPaymentLink(payload) {
  const { data } = await api.post("/api/manager/subscription", payload);
  return data; // { paymentLink, checkoutUrl, reference, etc. }
}

/* ------------------------------ Time Off ------------------------- */
/** GET /api/manager/timeoff?status= */
export async function listTimeOffRequests(params) {
  const { data } = await api.get("/api/manager/timeoff", { params });
  return data.timeOffRequests;
}

/** PATCH /api/manager/timeoff { id, status, startDate, endDate } */
export async function decideTimeOff({ id, status, startDate, endDate }) {
  const { data } = await api.patch("/api/manager/timeoff", {
    id,
    status,
    startDate,
    endDate,
  });
  return data; // { updated }
}

/** PUT /api/manager/timeoff { id, status, startDate, endDate, reason } */
export async function overrideTimeOff({
  id,
  status,
  startDate,
  endDate,
  reason,
}) {
  const { data } = await api.put("/api/manager/timeoff", {
    id,
    status,
    startDate,
    endDate,
    reason,
  });
  return data; // { updated }
}

/** DELETE /api/manager/timeoff?id= */
export async function forceRejectTimeOff(id) {
  const { data } = await api.delete("/api/manager/timeoff", { params: { id } });
  return data; // { message, updated }
}

/* ----------------------------- Billing --------------------------- */
/** GET /api/manager/billing - FIXED: Now requires businessId */
export async function getBilling(businessId, params = {}) {
  if (!businessId) {
    throw new Error("businessId is required for getBilling");
  }
  const res = await api.get("/api/manager/billing", {
    params: { businessId, ...params },
  });
  return res.data;
}

/** (Optional future) POST /api/manager/billing/checkout
 *  payload: { targetPlan: "LEVEL_2" } etc.
 *  returns { checkoutLink } or similar
 */
export async function startPlanCheckout(payload) {
  const { data } = await api.post("/api/manager/billing/checkout", payload);
  return data;
}