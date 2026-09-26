import { describe, expect, it } from "vitest";

import { decideSend, isQuietHours, keywordSignal, resolveInboundSignal } from "./opt-out";

const QUIET = {
  enabled: true,
  quietStart: "21:00",
  quietEnd: "08:00",
  timezone: "America/Chicago",
};

describe("TCPA opt-out", () => {
  it("treats STOP as opt-out and START as opt-in, including Twilio OptOutType", () => {
    expect(keywordSignal("STOP")).toBe("stop");
    expect(keywordSignal("stop-all")).toBe("stop");
    expect(keywordSignal("START")).toBe("start");
    expect(keywordSignal("HELP")).toBe("help");
    expect(resolveInboundSignal("hello", "STOP")).toBe("stop");
    expect(resolveInboundSignal("STOP", null)).toBe("stop");
  });

  it("blocks further sends after STOP and allows them after START", () => {
    const stopped = decideSend({
      kind: "automated",
      optedOut: true,
      quiet: null,
      hasConsent: true,
    });
    expect(stopped.ok).toBe(false);
    if (!stopped.ok) expect(stopped.reason).toMatch(/STOP/);

    const restored = decideSend({
      kind: "automated",
      optedOut: false,
      quiet: null,
      hasConsent: true,
    });
    expect(restored.ok).toBe(true);
  });

  it("does not treat HELP as an opt-out", () => {
    expect(keywordSignal("INFO")).toBe("help");
    const decision = decideSend({
      kind: "manual",
      optedOut: false,
      quiet: QUIET,
      hasConsent: false,
      now: new Date("2026-09-26T03:30:00Z"),
    });
    expect(decision.ok).toBe(true);
  });

  it("holds automated texts during quiet hours and still allows a manual text", () => {
    const night = new Date("2026-09-26T03:30:00Z");
    const noon = new Date("2026-09-26T17:00:00Z");
    expect(isQuietHours(QUIET, night)).toBe(true);
    expect(isQuietHours(QUIET, noon)).toBe(false);

    const automated = decideSend({
      kind: "automated",
      optedOut: false,
      quiet: QUIET,
      hasConsent: true,
      now: night,
    });
    expect(automated.ok).toBe(false);

    const manual = decideSend({
      kind: "manual",
      optedOut: false,
      quiet: QUIET,
      hasConsent: false,
      now: night,
    });
    expect(manual.ok).toBe(true);
  });

  it("requires a consent row for review and marketing texts", () => {
    const review = decideSend({
      kind: "review",
      optedOut: false,
      quiet: null,
      hasConsent: false,
    });
    expect(review.ok).toBe(false);
    const marketing = decideSend({
      kind: "marketing",
      optedOut: false,
      quiet: null,
      hasConsent: true,
    });
    expect(marketing.ok).toBe(true);
  });
});
