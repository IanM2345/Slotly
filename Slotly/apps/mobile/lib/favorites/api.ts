import AsyncStorage from "@react-native-async-storage/async-storage";
import type { FavoriteItem } from "./types";

const KEY = "slotly:favorites:v1";

async function read(): Promise<FavoriteItem[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as FavoriteItem[]; } catch { return []; }
}

async function write(items: FavoriteItem[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

export const favoritesApi = {
  async list(): Promise<FavoriteItem[]> {
    return read();
  },
  async add(item: FavoriteItem): Promise<void> {
    const current = await read();
    if (!current.some(x => x.id === item.id && x.kind === item.kind)) {
      await write([item, ...current]);
    }
  },
  async remove(id: string, kind: FavoriteItem["kind"]): Promise<void> {
    const current = await read();
    await write(current.filter(x => !(x.id === id && x.kind === kind)));
  },
  async clear(): Promise<void> {
    await write([]);
  },
};