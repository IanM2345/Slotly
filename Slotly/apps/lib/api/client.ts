
import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:3000';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type ApiError = {
  status: number | null;
  code?: string;
  message: string;
  details?: unknown;
};

let inMemoryToken: string | null = null;

export async function getToken() {
  if (inMemoryToken) return inMemoryToken;
  const t = await SecureStore.getItemAsync('slotly:token');
  inMemoryToken = t ?? null;
  return inMemoryToken;
}
export async function setToken(token: string | null) {
  inMemoryToken = token;
  if (token) await SecureStore.setItemAsync('slotly:token', token);
  else await SecureStore.deleteItemAsync('slotly:token');
}

const DEFAULT_TIMEOUT_MS = 25_000;
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);

async function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

async function request<T>(
  path: string,
  {
    method = 'GET',
    body,
    headers,
    timeout = DEFAULT_TIMEOUT_MS,
    retries = 2,
    schema, // optional Zod schema
  }: {
    method?: HttpMethod;
    body?: any;
    headers?: Record<string, string>;
    timeout?: number;
    retries?: number;
    schema?: z.ZodType<T>;
  } = {}
): Promise<T> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  const token = await getToken();
  const res = await (async function doFetch(attempt = 0): Promise<Response> {
    try {
      return await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err: any) {
      // Network/timeout → retry with backoff if we still can
      if (attempt < retries) {
        await sleep(2 ** attempt * 500);
        return doFetch(attempt + 1);
      }
      throw normalizeError(err);
    }
  })();
  clearTimeout(id);

  // 401 handling (no refresh flow in backend yet → sign out)
  if (res.status === 401) {
    await setToken(null);
    throw normalizeHttpError(res, 'Unauthorized. Please log in again.');
  }

  // backoff on 429/5xx
  if (RETRY_STATUS.has(res.status)) {
    let attempt = 0;
    while (attempt < 2 && RETRY_STATUS.has(res.status)) {
      await sleep(2 ** attempt * 600);
      attempt++;
      const retryRes = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!RETRY_STATUS.has(retryRes.status)) {
        return parseResponse<T>(retryRes, schema);
      }
    }
  }

  return parseResponse<T>(res, schema);
}

async function parseResponse<T>(res: Response, schema?: z.ZodType<T>): Promise<T> {
  const isJson = res.headers.get('content-type')?.includes('application/json');
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const errJson = isJson ? await res.json() : {};
      msg = (errJson?.error as string) || msg;
      throw normalizeHttpError(res, msg, errJson);
    } catch {
      throw normalizeHttpError(res, msg);
    }
  }
  const data = isJson ? await res.json() : (await res.text() as any);
  if (schema) {
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      throw <ApiError>{
        status: res.status,
        code: 'VALIDATION_ERROR',
        message: 'Unexpected server response shape',
        details: parsed.error.flatten(),
      };
    }
    return parsed.data;
  }
  return data as T;
}

function normalizeHttpError(res: Response, message: string, details?: unknown): ApiError {
  return {
    status: res.status,
    code: `HTTP_${res.status}`,
    message,
    details,
  };
}

function normalizeError(err: any): ApiError {
  if (err?.name === 'AbortError') {
    return { status: null, code: 'TIMEOUT', message: 'Request timed out' };
  }
  return { status: null, message: err?.message ?? 'Network error' };
}

export const api = {
  get: <T>(path: string, opts?: Parameters<typeof request<T>>[1]) =>
    request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: any, opts?: Parameters<typeof request<T>>[1]) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  put:  <T>(path: string, body?: any, opts?: Parameters<typeof request<T>>[1]) =>
    request<T>(path, { ...opts, method: 'PUT', body }),
  patch:<T>(path: string, body?: any, opts?: Parameters<typeof request<T>>[1]) =>
    request<T>(path, { ...opts, method: 'PATCH', body }),
  del:  <T>(path: string, opts?: Parameters<typeof request<T>>[1]) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
};
