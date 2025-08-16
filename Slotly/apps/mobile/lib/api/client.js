import axios from "axios";
import * as SecureStore from "expo-secure-store";

// Pick base URL from .env
const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_API_URL_WEB ||
  "http://localhost:3000";

// Create axios instance
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000, // 10s timeout
  headers: {
    "Content-Type": "application/json",
  },
});

// --- 🔑 Token helpers ---
async function getToken() {
  try {
    return await SecureStore.getItemAsync("accessToken");
  } catch (err) {
    console.warn("Error reading token:", err);
    return null;
  }
}

async function setToken(token) {
  try {
    await SecureStore.setItemAsync("accessToken", token);
  } catch (err) {
    console.warn("Error saving token:", err);
  }
}

async function clearToken() {
  try {
    await SecureStore.deleteItemAsync("accessToken");
  } catch (err) {
    console.warn("Error clearing token:", err);
  }
}

// ---  Interceptors ---
api.interceptors.request.use(
  async (config) => {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = Bearer ${token};
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error;

    // Handle 401 → auto logout
    if (response && response.status === 401) {
      console.warn("Unauthorized → clearing session");
      await clearToken();
      // TODO: redirect user to login screen
    }

    // Handle 429 → too many requests
    if (response && response.status === 429) {
      console.warn("Too many requests. Please slow down.");
    }

    // Retry logic for 5xx errors (basic backoff)
    if (response && response.status >= 500) {
      let retries = config.__retries || 0;
      if (retries < 3) {
        retries++;
        config.__retries = retries;
        const delay = Math.pow(2, retries) * 500; // exponential backoff
        await new Promise((res) => setTimeout(res, delay));
        return api(config); // retry
      }
    }

    return Promise.reject(error);
  }
);


export default api;
export { getToken, setToken, clearToken };