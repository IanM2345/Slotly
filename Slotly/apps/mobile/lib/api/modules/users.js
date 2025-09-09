import api from "../client";
import { jsonFetch } from "./_fetch";

/** Helper to attach Bearer token per-call (if your api client doesn't do it globally). */
function withAuth(config = {}, token) {
  if (!token) return config;
  return { ...config, headers: { ...(config.headers || {}), Authorization: `Bearer ${token}` } };
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/* ========================= USERS (admin-ish) ========================= */
/** GET /api/users — list users */
export async function getUsers(config) {
  const { data } = await api.get("/api/users", config);
  return data;
}

/** POST /api/users — create user */
export async function createUser(payload, config) {
  const { data } = await api.post("/api/users", payload, config);
  return data;
}

/** PUT /api/users/:id — update by id */
export async function updateUser(id, payload, config) {
  if (!id) throw new Error("updateUser requires a user id");
  const { data } = await api.put(`/api/users/${id}`, payload, config);
  return data;
}

/** DELETE /api/users/:id — delete by id */
export async function deleteUser(id, config) {
  if (!id) throw new Error("deleteUser requires a user id");
  const { data } = await api.delete(`/api/users/${id}`, config);
  return data;
}

/* ============================ ME (/me) ============================== */
/** GET /api/users/me — returns current profile (preload-friendly) */
export async function getMe(token) {
  return jsonFetch("/api/users/me", { method: "GET", headers: authHeaders(token) });
}

/** PATCH /api/users/me — update name/phone/avatar */
export async function updateMe(payload, token) {
  return jsonFetch("/api/users/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(payload),
  });
}

/** DELETE /api/users/me — deletes user + related data */
export async function deleteMe(token) {
  return jsonFetch("/api/users/me", { method: "DELETE", headers: authHeaders(token) });
}

/** RN helper: upload file to Cloudinary (unsigned) */
export async function uploadToCloudinary({ fileUri, uploadPreset, cloudName }) {
  if (!fileUri) throw new Error("fileUri required");
  if (!uploadPreset || !cloudName) throw new Error("cloudName & uploadPreset required");
  
  const form = new FormData();
  form.append("file", { uri: fileUri, name: "avatar.jpg", type: "image/jpeg" });
  form.append("upload_preset", uploadPreset);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "Cloudinary upload failed");
  return data.secure_url;
}

/* ============================ ADDRESS =============================== */
/** GET /api/users/address — returns user address or {} if none */
export async function getMyAddress(token) {
  const { data } = await api.get("/api/users/address", withAuth({}, token));
  return data; // {} if none
}

/** PUT /api/users/address — upsert user address */
export async function updateMyAddress(payload, token) {
  const { data } = await api.put("/api/users/address", payload, withAuth({}, token));
  return data; // saved address
}

/* ========================= NOTIFICATIONS ============================ */
/** GET /api/users/notifications?page&limit */
export async function getNotifications({ page = 1, limit = 10 } = {}, token) {
  const { data } = await api.get(
    `/api/users/notifications?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`,
    withAuth({}, token)
  );
  return data; // { page, limit, total, notifications } (uses decoded.userId)
}

/** PATCH /api/users/notifications — { notificationIds: string[], read: boolean } */
export async function markNotifications({ notificationIds, read }, token) {
  const { data } = await api.patch(
    "/api/users/notifications",
    { notificationIds, read },
    withAuth({}, token)
  );
  return data; // { count }
}

/** DELETE /api/users/notifications?id=... */
export async function deleteNotification(notificationId, token) {
  if (!notificationId) throw new Error("deleteNotification requires a notification id");
  const { data } = await api.delete(
    `/api/users/notifications?id=${encodeURIComponent(notificationId)}`,
    withAuth({}, token)
  );
  return data; // { message: 'Notification dismissed' }
}

/* ============================ BOOKINGS ============================== */
/** GET /api/users/bookings — returns { upcomingBookings, pastBookings } */
export async function listBookings(token) {
  const { data } = await api.get("/api/users/bookings", withAuth({}, token));
  return data; // includes service, business, payment, reminder in each item
}

/** POST /api/users/bookings — create booking (supports couponCode) */
export async function createBooking(payload, token) {
  // payload must include: serviceId, businessId, startTime, endTime; optional: status, couponCode
  const { data } = await api.post("/api/users/bookings", payload, withAuth({}, token));
  return data; // returns booking (includes service, business, payment, reminder, coupon)
}

/** POST /api/users/bookings/:id/cancel — may trigger late fee, sets status CANCELLED */
export async function cancelBooking(id, payload = {}, token) {
  if (!id) throw new Error("cancelBooking requires a booking id");
  const { data } = await api.post(`/api/users/bookings/${id}/cancel`, payload, withAuth({}, token));
  return data; // { message, updatedBooking } (auth requires role CUSTOMER)
}

/** PATCH /api/users/bookings/:id/reschedule — body: { newStartTime, newEndtime } */
export async function rescheduleBooking(id, payload, token) {
  if (!id) throw new Error("rescheduleBooking requires a booking id");
  const { data } = await api.patch(`/api/users/bookings/${id}/reschedule`, payload, withAuth({}, token));
  return data; // returns { message, updatedBooking } (blocks inside cancellation deadline)
}

/* ============================ COUPONS =============================== */
/** GET /api/users/coupon — returns { available, used, expired } */
export async function getCoupons(token) {
  const { data } = await api.get("/api/users/coupon", withAuth({}, token));
  return data; // may also issue milestone reward coupon + notifications when threshold met
}

/* ============================ FAVOURITES ============================ */
/** GET /api/users/favourites */
export async function getFavourites(params = {}, token) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null)).toString();
  const url = qs ? `/api/users/favourites?${qs}` : "/api/users/favourites";
  const { data } = await api.get(url, withAuth({}, token));
  return data; // includes business + selected staff fields
}

/** POST /api/users/favourites — body: { businessId? , staffId? } (one required) */
export async function addFavourite(payload, token) {
  const { data } = await api.post("/api/users/favourites", payload, withAuth({}, token));
  return data; // returns created favourite
}

/** DELETE /api/users/favourites?businessId=... OR &staffId=... */
export async function removeFavourite({ businessId, staffId }, token) {
  if (!businessId && !staffId) throw new Error("removeFavourite requires businessId or staffId");
  const params = new URLSearchParams();
  if (businessId) params.set("businessId", businessId);
  if (staffId) params.set("staffId", staffId);
  const { data } = await api.delete(`/api/users/favourites?${params.toString()}`, withAuth({}, token));
  return data; // { message: 'Favourite deleted successfully' }
}

/* ============================ REFERRALS ============================= */
/** GET /api/users/referrals — returns list w/ completedBookings & rewardIssued; may issue reward */
export async function getReferrals(token) {
  const { data } = await api.get("/api/users/referrals", withAuth({}, token));
  return data; // endpoint can auto-issue coupon + notifications if milestone hit
}

/* ============================= REVIEWS ============================== */
/** GET /api/users/reviews — my reviews */
export async function getMyReviews(token) {
  const { data } = await api.get("/api/users/reviews", withAuth({}, token));
  return data; // includes business { id, name } and orders by createdAt desc
}

/** POST /api/users/reviews — upsert by businessId or bookingId */
export async function createOrUpdateReview({ businessId, bookingId, rating, comment, imageUrl }) {
  const payload = { businessId, bookingId, rating, comment, imageUrl };

  // Pull the latest access token straight from SecureStore
  const token = await getAccessToken();
  if (!token) throw new Error("Not signed in");

  // Use absolute URL to avoid any baseURL confusion
  const url = `${API_BASE_URL}/api/users/reviews`;

  const res = await jsonFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return res;
}

/** DELETE /api/users/reviews?businessId=... */
export async function deleteReview(businessId, token) {
  if (!businessId) throw new Error("deleteReview requires a businessId");
  const { data } = await api.delete(`/api/users/reviews?businessId=${encodeURIComponent(businessId)}`, withAuth({}, token));
  return data; // { message: 'Review deleted' }
}

/* ========================= PASSWORD CHANGE =========================== */
export async function changePassword({ currentPassword, newPassword }, token) {
  const { data } = await api.post(
    "/api/users/change-password",
    { currentPassword, newPassword },
    withAuth({}, token)
  );
  return data; // { message: 'Password updated' }
}