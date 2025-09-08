// apps/mobile/lib/api/modules/search.js

/**
 * Client for /api/search (Slotly).
 *
 * Backend contract (from your route):
 *   GET    /api/search?service=&lat=&lon=&date=&time=&userId=&category=&kind=&limit=&startAt=
 *           -> { services: [...], businesses: [...], suggested?: {...}, recentSearches: [...] }
 *   DELETE /api/search?userId=
 *           -> { message: 'Search history cleared' }
 */

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  ''; // e.g. https://api.slotly.example.com

const DEFAULT_TIMEOUT_MS = 20_000;

function ensureBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error('API_BASE_URL not set. Configure EXPO_PUBLIC_API_BASE_URL or API_BASE_URL.');
  }
}

function qs(params = {}) {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ''
  );
  return entries.length ? `?${new URLSearchParams(Object.fromEntries(entries)).toString()}` : '';
}

async function http(path, { method = 'GET', headers = {}, timeout = DEFAULT_TIMEOUT_MS } = {}) {
  ensureBaseUrl();

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: { Accept: 'application/json', ...headers },
      signal: controller.signal,
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
  } catch (e) {
    // Mark aborts as a specific error so the UI can detect them
    if (e.name === 'AbortError') {
      const err = new Error('ABORTED');
      err.name = 'AbortError';
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Search services/businesses near a coordinate with availability.
 * @param {{
 *   service?: string;
 *   lat: number;
 *   lon: number;
 *   date?: string;   // YYYY-MM-DD (defaults server-side)
 *   time?: 'morning'|'afternoon'|'evening'|'anytime';
 *   startAt?: string; // ISO string when using exact time
 *   userId?: string; // Mongo ObjectId (optional)
 *   category?: string;
 *   kind?: 'both'|'services'|'businesses';
 *   limit?: number;
 * }} params
 * @returns {Promise<{services: Array, businesses: Array, suggested?: {services:Array, businesses:Array}, recentSearches: Array}>}
 */
export async function searchNearby(params, { timeoutMs = 2000 } = {}) {
  if (typeof params?.lat !== 'number' || typeof params?.lon !== 'number') {
    throw new Error('lat and lon are required numbers');
  }

  const path = `/api/search${qs({
    service: params.service || '',
    lat: params.lat,
    lon: params.lon,
    date: params.date,              // let server default if not provided
    time: (params.time || 'anytime').toLowerCase(),
    startAt: params.startAt,        // ISO string when using exact time
    userId: params.userId,
    category: params.category,
    kind: (params.kind || 'both').toLowerCase(),
    limit: params.limit || 24,
  })}`;

  return http(path, { method: 'GET', timeout: timeoutMs });
}

/**
 * Clear recent searches for a user.
 * @param {string} userId - Mongo ObjectId
 * @returns {Promise<{message: string}>}
 */
export async function clearRecentSearches(userId) {
  if (!userId) throw new Error('userId is required');
  const path = `/api/search${qs({ userId })}`;
  return http(path, { method: 'DELETE' });
}

/* ---------------------------
 * Optional: tiny React hooks
 * --------------------------*/

/**
 * useSearchNearby – debounced search hook for RN/React
 * Example:
 *   const { data, loading, error, search } = useSearchNearby();
 *   useEffect(() => { search({ service, lat, lon, time, userId, category, kind, limit }); }, [deps]);
 */
export function useSearchNearby({ debounceMs = 350 } = {}) {
  // if you're not in React, you can delete this section
  const React = require('react');
  const { useRef, useState, useCallback } = React;

  const timer = useRef(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const search = useCallback((params, options = {}) => {
    if (timer.current) clearTimeout(timer.current);
    setLoading(true);
    setError(null);

    timer.current = setTimeout(async () => {
      try {
        const res = await searchNearby(params, options);
        setData(res);
      } catch (e) {
        // Handle aborted fetches quietly
        if (e?.name === 'AbortError' || e?.message === 'ABORTED') {
          setLoading(false);
          return;
        }
        setError(e);
      } finally {
        setLoading(false);
      }
    }, debounceMs);
  }, [debounceMs]);

  const reset = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, search, reset };
}