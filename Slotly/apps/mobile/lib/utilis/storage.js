import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export const storage = {
  async setItem(key, value) {
    const str = typeof value === "string" ? value : JSON.stringify(value);
    if (Platform.OS === "web") {
      localStorage.setItem(key, str);
    } else {
      await SecureStore.setItemAsync(key, str);
    }
  },
  async getItem(key) {
    if (Platform.OS === "web") {
      return localStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  },
  async setJSON(key, obj) {
    return this.setItem(key, JSON.stringify(obj));
  },
  async getJSON(key) {
    try {
      const raw = await this.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  async removeItem(key) {
    if (Platform.OS === "web") {
      localStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  },
};
