import { idleSnapshot, type VoiceSnapshot } from "./types";

export function createSnapshotStore(initial: VoiceSnapshot = idleSnapshot) {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(patch: Partial<VoiceSnapshot>) {
      snapshot = { ...snapshot, ...patch };
      for (const listener of listeners) listener();
    },
    resetCall() {
      snapshot = {
        ...snapshot,
        phase: "idle",
        remoteParty: "",
        muted: false,
        speaker: false,
        startedAt: null,
        direction: "outbound",
      };
      for (const listener of listeners) listener();
    },
  };
}
