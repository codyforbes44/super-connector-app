import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { AppState, Platform } from "react-native";

import { api } from "@/api";
import { useAuth } from "@/auth";
import { previewMode } from "@/config";
import { deviceId } from "@/storage";
import { createVoiceController } from "./client";
import type { VoiceController, VoiceSnapshot } from "./types";

const VoiceContext = createContext<VoiceController | null>(null);

export function VoiceProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [controller] = useState(createVoiceController);

  useEffect(() => {
    if (!token) {
      void controller.unregister();
      return;
    }
    void controller.register(token);
  }, [controller, token]);

  useEffect(() => {
    if (!token || previewMode()) return;
    const os = Platform.OS;
    if (os !== "ios" && os !== "android") return;
    let alive = true;
    const beat = () => {
      void (async () => {
        try {
          const id = await deviceId();
          if (!alive) return;
          await api.presence(token, { online: true, platform: os, deviceId: id });
        } catch {
          // The next heartbeat retries. A missed beat must not tear the call down.
        }
      })();
    };
    beat();
    const timer = setInterval(beat, 30_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") beat();
    });
    return () => {
      alive = false;
      clearInterval(timer);
      subscription.remove();
      void (async () => {
        try {
          const id = await deviceId();
          await api.presence(token, { online: false, platform: os, deviceId: id });
        } catch {
          // Logout still proceeds if the last heartbeat cannot be sent.
        }
      })();
    };
  }, [token]);

  return <VoiceContext.Provider value={controller}>{children}</VoiceContext.Provider>;
}

export function useVoice(): VoiceController {
  const value = useContext(VoiceContext);
  if (!value) throw new Error("useVoice must be used inside VoiceProvider.");
  return value;
}

export function useVoiceSnapshot(): VoiceSnapshot {
  const voice = useVoice();
  return useSyncExternalStore(voice.subscribe, voice.getSnapshot, voice.getSnapshot);
}
