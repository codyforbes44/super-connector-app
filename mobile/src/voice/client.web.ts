import { previewMode } from "@/config";
import { createSnapshotStore } from "./store";
import type { VoiceController } from "./types";

/** Web and Expo Go cannot load the Twilio native module. The UI still renders. */
export function createVoiceController(): VoiceController {
  const store = createSnapshotStore({
    status: previewMode() ? "registered" : "unavailable",
    phase: "idle",
    remoteParty: "",
    direction: "outbound",
    muted: false,
    speaker: false,
    error: previewMode()
      ? null
      : "Calls run in the iOS and Android app. This preview can sign in and read the inbox.",
    pushConfigured: false,
    startedAt: null,
  });

  return {
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
    async register() {
      store.set({ status: previewMode() ? "registered" : "unavailable" });
    },
    async unregister() {
      store.set({ status: "idle", pushConfigured: false });
      store.resetCall();
    },
    async call(to: string) {
      if (!previewMode()) throw new Error("Place this call from the installed SixVox app.");
      store.set({ phase: "active", direction: "outbound", remoteParty: to, startedAt: Date.now(), muted: false });
    },
    async accept() {
      store.set({ phase: "active", startedAt: Date.now() });
    },
    async reject() {
      store.resetCall();
    },
    async hangup() {
      store.resetCall();
    },
    async toggleMute() {
      store.set({ muted: !store.getSnapshot().muted });
    },
    async toggleSpeaker() {
      store.set({ speaker: !store.getSnapshot().speaker });
    },
    async sendDigit() {
      return;
    },
    previewRing() {
      store.set({
        phase: "ringing",
        direction: "inbound",
        remoteParty: "+15555550999",
        muted: false,
        startedAt: null,
      });
    },
  };
}
