// apps/mobile/lib/api/modules/_fetch.js
import api from "../client";

/**
 * Drop-in replacement for the old fetch wrapper that uses the Axios client.
 * It inherits the baseURL + auth header + retries from api/client.js
 */
export async function jsonFetch(
  url,
  { method = "GET", body, token, params, headers = {}, timeout = 20000 } = {}
) {
  const cfg = {
    url,
    method,
    data: body,
    params,
    timeout,
    headers: { ...headers },
  };
  if (token) cfg.headers.Authorization = `Bearer ${token}`;

  try {
    const { data } = await api.request(cfg);
    return data;
  } catch (err) {
    const msg =
      err?.response?.data?.error ||
      err?.response?.data?.message ||
      err?.message ||
      "Request failed";
    const e = new Error(msg);
    e.response = err?.response;
    throw e;
  }
}

/**
 * Form data fetch for file uploads - also uses Axios client
 * @param {string} path - API endpoint path
 * @param {FormData} formData - Form data with files
 * @param {string} token - Bearer token for authentication
 * @returns {Promise<Object>} - Parsed JSON response
 */
export async function formDataFetch(path, formData, token) {
  const cfg = {
    url: path,
    method: "POST",
    data: formData,
    headers: {
      "Content-Type": "multipart/form-data",
    },
    timeout: 30000, // Longer timeout for file uploads
  };
  if (token) cfg.headers.Authorization = `Bearer ${token}`;

  try {
    const { data } = await api.request(cfg);
    return data;
  } catch (err) {
    const msg =
      err?.response?.data?.error ||
      err?.response?.data?.message ||
      err?.message ||
      "Upload failed";
    const e = new Error(msg);
    e.response = err?.response;
    throw e;
  }
}