import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const CHUNK = 1800;

/**
 * Supabase sessions are larger than SecureStore's per-value limit, so values
 * are split. Web preview uses localStorage because SecureStore is native-only.
 */
export const authStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === "web") return globalThis.localStorage?.getItem(key) ?? null;
    const countRaw = await SecureStore.getItemAsync(`${key}.n`);
    if (!countRaw) return SecureStore.getItemAsync(key);
    const count = Number(countRaw);
    if (!Number.isFinite(count) || count < 1) return null;
    const parts: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`);
      if (part == null) return null;
      parts.push(part);
    }
    return parts.join("");
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") {
      globalThis.localStorage?.setItem(key, value);
      return;
    }
    if (value.length <= CHUNK) {
      await SecureStore.setItemAsync(key, value);
      await SecureStore.deleteItemAsync(`${key}.n`);
      return;
    }
    const count = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < count; i += 1) {
      await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
    }
    await SecureStore.setItemAsync(`${key}.n`, String(count));
    await SecureStore.deleteItemAsync(key);
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === "web") {
      globalThis.localStorage?.removeItem(key);
      return;
    }
    const countRaw = await SecureStore.getItemAsync(`${key}.n`);
    const count = Number(countRaw ?? "0");
    if (Number.isFinite(count)) {
      for (let i = 0; i < count; i += 1) await SecureStore.deleteItemAsync(`${key}.${i}`);
    }
    await SecureStore.deleteItemAsync(`${key}.n`);
    await SecureStore.deleteItemAsync(key);
  },
};

const DEVICE_KEY = "sixvox.deviceId";

export async function deviceId(): Promise<string> {
  const existing = await authStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const created = globalThis.crypto?.randomUUID?.() ?? `device-${Date.now()}`;
  await authStorage.setItem(DEVICE_KEY, created);
  return created;
}
