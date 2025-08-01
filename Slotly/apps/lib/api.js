
import * as SecureStore from 'expo-secure-store';

const BASE_URL = 'http://localhost:3000/api'; 

async function getToken() {
  return await SecureStore.getItemAsync('jwt');
}

export async function apiFetch(endpoint, options = {}) {
  const token = await getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let err;
    try {
      err = await res.json();
    } catch {
      err = {};
    }
    throw new Error(err?.error || res.statusText || 'Request failed');
  }

  return res.json();
}
