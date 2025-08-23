// apps/mobile/lib/api/modules/manager.js
import api from "../../api/client";

/* --------------------------- Analytics --------------------------- */
/** GET /api/manager/analytics
 * Supports params:
 *  - view: "daily" | "weekly" | "monthly"
 *  - startDate, endDate (ISO)
 *  - metrics: CSV list
 *  - smoothing: "true" | "false"
 *  - abGroup
 *  - staffLimit
 *  - export: "csv" (returns CSV bytes)
 */
export async function getAnalytics(params) {
  const isCsv = params?.export === "csv";
  const res = await api.get("api/manager/analytics", {
    params,
    ...(isCsv ? { responseType: "arraybuffer" } : {}),
  });
  return res.data; // JSON or CSV bytes
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
  const { data } = await api.get("api/manager/me");
  return data;
}

/** Update address/coords/hours for the current owner's business */
export async function updateBusinessProfile(payload) {
  const { data } = await api.put("api/manager/me", payload);
  // backend returns { message, business }
  return data.business ?? data;
}

/* ---------------------------- Reports ---------------------------- */
/** GET /api/manager/reports */
export async function listReports(params) {
  const { data } = await api.get("api/manager/reports", { params });
  return data;
}

/** GET /api/manager/reports/[id] → PDF bytes */
export async function previewReport({ reportId }) {
  const res = await api.get(`api/manager/reports/${reportId}`, {
    responseType: "arraybuffer",
  });
  return res.data; // PDF bytes
}

/* ---------------------------- Bookings --------------------------- */
/** GET /api/manager/bookings?staffId=&serviceId=&date= */
export async function listBookings(params) {
  const { data } = await api.get("api/manager/bookings", { params });
  return data.bookings;
}

/** PATCH /api/manager/bookings { action: 'reassign', id, staffId } */
export async function reassignBookingStaff({ id, staffId }) {
  const { data } = await api.patch("api/manager/bookings", { action: "reassign", id, staffId });
  return data; // { message, booking }
}

/** PATCH /api/manager/bookings { action: 'reschedule', id, startTime } */
export async function rescheduleBooking({ id, startTime }) {
  const { data } = await api.patch("api/manager/bookings", { action: "reschedule", id, startTime });
  return data; // { message, booking }
}

/** PATCH /api/manager/bookings { action: 'cancel', id, reason? } */
export async function cancelManagerBooking({ id, reason }) {
  const { data } = await api.patch("api/manager/bookings", { action: "cancel", id, reason });
  return data; // { message, booking }
}


/* ----------------------------- Bundles --------------------------- */
/** GET /api/manager/bundles */
export async function listBundles() {
  const { data } = await api.get("api/manager/bundles");
  return data.bundles;
}

/** POST /api/manager/bundles */
export async function createBundle(payload) {
  const { data } = await api.post("api/manager/bundles", payload);
  return data; // created bundle
}

/** DELETE /api/manager/bundles?id= */
export async function deleteBundle(id) {
  const { data } = await api.delete("api/manager/bundles", { params: { id } });
  return data; // { message }
}

/* ----------------------------- Coupons --------------------------- */
/** GET /api/manager/coupons?active=&expired=&used= */
export async function listCoupons(params) {
  const { data } = await api.get("api/manager/coupons", { params });
  return data.coupons;
}

/** POST /api/manager/coupons */
export async function createCoupon(payload) {
  const { data } = await api.post("api/manager/coupons", payload);
  return data; // created coupon
}

/** DELETE /api/manager/coupons?id= */
export async function deleteCoupon(id) {
  const { data } = await api.delete("api/manager/coupons", { params: { id } });
  return data; // { message }
}

/* ------------------------------- Me ------------------------------ */
/** GET /api/manager/me */
export async function getMe() {
  const { data } = await api.get("api/manager/me");
  return data; // business object
}

/** PUT /api/manager/me */
export async function updateMe(payload) {
  const { data } = await api.put("api/manager/me", payload);
  return data; // { message, business }
}

/* --------------------------- Performance ------------------------- */
/** GET /api/manager/performance?start=&end= */
export async function getPerformance(params) {
  const { data } = await api.get("api/manager/performance", { params });
  return data;
}

/* ----------------------------- Reviews --------------------------- */
/** GET /api/manager/reviews */
export async function listReviews() {
  const { data } = await api.get("api/manager/reviews");
  return data.reviews;
}

/** PATCH /api/manager/reviews?id= */
export async function flagReview(id) {
  const { data } = await api.patch("api/manager/reviews", null, {
    params: { id },
  });
  return data; // { message, review }
}

/* ----------------------------- Services -------------------------- */
/** POST /api/manager/services */
export async function createService(payload) {
  const { data } = await api.post("api/manager/services", payload);
  return data;
}

/** PUT /api/manager/services */
export async function updateService(payload) {
  const { data } = await api.put("api/manager/services", payload);
  return data;
}

/** DELETE /api/manager/services?id= */
export async function deleteService(id) {
  const { data } = await api.delete("api/manager/services", { params: { id } });
  return data;
}

/** PATCH /api/manager/services { id, available } */
export async function toggleServiceAvailability({ id, available }) {
  const { data } = await api.patch("api/manager/services", { id, available });
  return data;
}

export async function listServices(params) {
  const { data } = await api.get("api/manager/services", { params });
  return data.services;
}

/* ---------------------- Services → Staff lists -------------------- */
/** GET /api/manager/services/staff */
export async function listStaffByServiceAssignment() {
  const { data } = await api.get("api/manager/services/staff");
  return data; // { assigned, unassigned } (per backend)
}

/* ---------------- Services → Staff assign/unassign ---------------- */
/** POST /api/manager/services/staff/assign { serviceId, staffId } */
export async function assignStaffToService({ serviceId, staffId }) {
  const { data } = await api.post("api/manager/services/staff/assign", {
    serviceId,
    staffId,
  });
  return data; // { message }
}

/** DELETE /api/manager/services/staff/unassign with JSON body */
export async function unassignStaffFromService({ serviceId, staffId }) {
  // axios supports a request body on DELETE via `data`
  const { data } = await api.delete("api/manager/services/staff/unassign", {
    data: { serviceId, staffId },
  });
  return data; // { message }
}

// Back-compat aliases for older screens
export const getStaff = async () => {
  const data = await listStaff();
  // listStaff() currently returns { approvedStaff, pendingEnrollments }
  return data.approvedStaff ?? data;    // keep old callers happy
};

export const getBookings = async (/* businessId? */) => {
  // If your endpoint doesn’t need businessId, just ignore the param
  return await listBookings({});
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
/** GET /api/manager/staff */
export async function listStaff() {
  const { data } = await api.get("api/manager/staff");
  return data; // { approvedStaff, pendingEnrollments } (per backend)
}

/** PUT /api/manager/staff { enrollmentId, status } */
export async function reviewStaffEnrollment({ enrollmentId, status }) {
  const { data } = await api.put("api/manager/staff", { enrollmentId, status });
  return data; // { message, enrollment }
}

/** DELETE /api/manager/staff?id= */
export async function removeStaff(id) {
  const { data } = await api.delete("api/manager/staff", { params: { id } });
  return data; // { message, removedStaff }
}

/* --------------------------- Subscription ------------------------ */
/** GET /api/manager/subscription */
export async function getSubscription() {
  const { data } = await api.get("api/manager/subscription");
  return data; // subscription info
}

/** POST /api/manager/subscription */
export async function createSubscriptionPaymentLink(payload) {
  const { data } = await api.post("api/manager/subscription", payload);
  return data; // { paymentLink, checkoutUrl, reference, etc. }
}

/* ------------------------------ Time Off ------------------------- */
/** GET /api/manager/timeoff?status= */
export async function listTimeOffRequests(params) {
  const { data } = await api.get("api/manager/timeoff", { params });
  return data.timeOffRequests;
}

/** PATCH /api/manager/timeoff { id, status, startDate, endDate } */
export async function decideTimeOff({ id, status, startDate, endDate }) {
  const { data } = await api.patch("api/manager/timeoff", {
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
  const { data } = await api.put("api/manager/timeoff", {
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
  const { data } = await api.delete("api/manager/timeoff", { params: { id } });
  return data; // { message, updated }
}