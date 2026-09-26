import { describe, expect, it } from "vitest";

import { createSnapshotStore } from "./store";

describe("voice snapshot store", () => {
  it("notifies listeners and clears a finished call", () => {
    const store = createSnapshotStore();
    let seen = 0;
    store.subscribe(() => {
      seen += 1;
    });
    store.set({
      phase: "active",
      remoteParty: "+15555550123",
      muted: true,
      speaker: true,
      startedAt: 1,
    });
    expect(store.getSnapshot().phase).toBe("active");
    store.resetCall();
    expect(store.getSnapshot()).toMatchObject({
      phase: "idle",
      remoteParty: "",
      muted: false,
      speaker: false,
      startedAt: null,
    });
    expect(seen).toBe(2);
  });
});
