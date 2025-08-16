
import api from "../../api/client";

/** Helper to attach Bearer token per-call (if your api client doesn't do it globally). */
function withAuth(config = {}, token) {
  if (!token) return config;
  return { ...config, headers: { ...(config.headers || {}), Authorization: `Bearer ${token}` } };
}

/* ========================= USERS (admin-ish) ========================= */
/** GET /api/users — list users */
export async function getUsers(config) {
  const { data } = await api.get("/users", config);
  return data;
}

/** POST /api/users — create user */
export async function createUser(payload, config) {
  const { data } = await api.post("/users", payload, config);
  return data;
}

/** PUT /api/users/:id — update by id */
export async function updateUser(id, payload, config) {
  if (!id) throw new Error("updateUser requires a user id");
  const { data } = await api.put(`/users/${id}`, payload, config);
  return data;
}

/** DELETE /api/users/:id — delete by id */
export async function deleteUser(id, config) {
  if (!id) throw new Error("deleteUser requires a user id");
  const { data } = await api.delete(`/users/${id}`, config);
  return data;
}

/* ============================ ME (/me) ============================== */
/** GET /api/users/me — returns {id,email,name,phone,role,createdAt} */
export async function getMe(token) {
  const { data } = await api.get("/users/me", withAuth({}, token));
  return data; // GET /users/me expects role CUSTOMER and uses decoded.id :contentReference[oaicite:0]{index=0}
}

/** PATCH /api/users/me — accepts { name?, phone?, password? } */
export async function updateMe(payload, token) {
  const { data } = await api.patch("/users/me", payload, withAuth({}, token));
  return data; // PATCH /users/me validates min password length 6 :contentReference[oaicite:1]{index=1}
}

/** DELETE /api/users/me — deletes user + related enrollments/bookings */
export async function deleteMe(token) {
  const { data } = await api.delete("/users/me", withAuth({}, token));
  return data; // { message: 'User deleted successfully' } :contentReference[oaicite:2]{index=2}
}

/* ========================= NOTIFICATIONS ============================ */
/** GET /api/users/notifications?page&limit */
export async function getNotifications({ page = 1, limit = 10 } = {}, token) {
  const { data } = await api.get(
    `/users/notifications?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`,
    withAuth({}, token)
  );
  return data; // { page, limit, total, notifications } (uses decoded.userId) :contentReference[oaicite:3]{index=3}
}

/** PATCH /api/users/notifications — { notificationIds: string[], read: boolean } */
export async function markNotifications({ notificationIds, read }, token) {
  const { data } = await api.patch(
    "/users/notifications",
    { notificationIds, read },
    withAuth({}, token)
  );
  return data; // { count } :contentReference[oaicite:4]{index=4}
}

/** DELETE /api/users/notifications?id=... */
export async function deleteNotification(notificationId, token) {
  if (!notificationId) throw new Error("deleteNotification requires a notification id");
  const { data } = await api.delete(
    `/users/notifications?id=${encodeURIComponent(notificationId)}`,
    withAuth({}, token)
  );
  return data; // { message: 'Notification dismissed' } :contentReference[oaicite:5]{index=5}
}

/* ============================ BOOKINGS ============================== */
/** GET /api/users/bookings — returns { upcomingBookings, pastBookings } */
export async function listBookings(token) {
  const { data } = await api.get("/users/bookings", withAuth({}, token));
  return data; // includes service, business, payment, reminder in each item :contentReference[oaicite:6]{index=6}
}

/** POST /api/users/bookings — create booking (supports couponCode) */
export async function createBooking(payload, token) {
  // payload must include: serviceId, businessId, startTime, endTime; optional: status, couponCode
  const { data } = await api.post("/users/bookings", payload, withAuth({}, token));
  return data; // returns booking (includes service, business, payment, reminder, coupon) :contentReference[oaicite:7]{index=7}
}

/** POST /api/users/bookings/:id/cancel — may trigger late fee, sets status CANCELLED */
export async function cancelBooking(id, payload = {}, token) {
  if (!id) throw new Error("cancelBooking requires a booking id");
  const { data } = await api.post(`/users/bookings/${id}/cancel`, payload, withAuth({}, token));
  return data; // { message, updatedBooking } (auth requires role CUSTOMER) :contentReference[oaicite:8]{index=8}
}

/** PATCH /api/users/bookings/:id/reschedule — body: { newStartTime, newEndtime } */
export async function rescheduleBooking(id, payload, token) {
  if (!id) throw new Error("rescheduleBooking requires a booking id");
  const { data } = await api.patch(`/users/bookings/${id}/reschedule`, payload, withAuth({}, token));
  return data; // returns { message, updatedBooking } (blocks inside cancellation deadline) :contentReference[oaicite:9]{index=9}
}

/* ============================ COUPONS =============================== */
/** GET /api/users/coupon — returns { available, used, expired } */
export async function getCoupons(token) {
  const { data } = await api.get("/users/coupon", withAuth({}, token));
  return data; // may also issue milestone reward coupon + notifications when threshold met :contentReference[oaicite:10]{index=10}
}

/* ============================ FAVOURITES ============================ */
/** GET /api/users/favourites */
export async function getFavourites(params = {}, token) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null)).toString();
  const url = qs ? `/users/favourites?${qs}` : "/users/favourites";
  const { data } = await api.get(url, withAuth({}, token));
  return data; // includes business + selected staff fields :contentReference[oaicite:11]{index=11}
}

/** POST /api/users/favourites — body: { businessId? , staffId? } (one required) */
export async function addFavourite(payload, token) {
  const { data } = await api.post("/users/favourites", payload, withAuth({}, token));
  return data; // returns created favourite :contentReference[oaicite:12]{index=12}
}

/** DELETE /api/users/favourites?businessId=... OR &staffId=... */
export async function removeFavourite({ businessId, staffId }, token) {
  if (!businessId && !staffId) throw new Error("removeFavourite requires businessId or staffId");
  const params = new URLSearchParams();
  if (businessId) params.set("businessId", businessId);
  if (staffId) params.set("staffId", staffId);
  const { data } = await api.delete(`/users/favourites?${params.toString()}`, withAuth({}, token));
  return data; // { message: 'Favourite deleted successfully' } :contentReference[oaicite:13]{index=13}
}

/* ============================ REFERRALS ============================= */
/** GET /api/users/referrals — returns list w/ completedBookings & rewardIssued; may issue reward */
export async function getReferrals(token) {
  const { data } = await api.get("/users/referrals", withAuth({}, token));
  return data; // endpoint can auto-issue coupon + notifications if milestone hit :contentReference[oaicite:14]{index=14}
}

/* ============================= REVIEWS ============================== */
/** GET /api/users/reviews — my reviews */
export async function getMyReviews(token) {
  const { data } = await api.get("/users/reviews", withAuth({}, token));
  return data; // includes business { id, name } and orders by createdAt desc :contentReference[oaicite:15]{index=15}
}

/** POST /api/users/reviews — upsert by businessId */
export async function createOrUpdateReview({ businessId, rating, comment }, token) {
  const { data } = await api.post("/users/reviews", { businessId, rating, comment }, withAuth({}, token));
  return data; // creates or updates unique (userId,businessId) review :contentReference[oaicite:16]{index=16}
}

/** DELETE /api/users/reviews?businessId=... */
export async function deleteReview(businessId, token) {
  if (!businessId) throw new Error("deleteReview requires a businessId");
  const { data } = await api.delete(`/users/reviews?businessId=${encodeURIComponent(businessId)}`, withAuth({}, token));
  return data; // { message: 'Review deleted' } :contentReference[oaicite:17]{index=17}
}
