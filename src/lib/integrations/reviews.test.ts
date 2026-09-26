import { describe, expect, it } from "vitest";

import { decideReviewRequest } from "./reviews";

const READY = {
  optedOut: false,
  messagingServiceSid: "MG123",
  textingReady: true,
  now: new Date("2026-09-26T18:00:00Z"),
  timezone: "America/Chicago",
  quietStart: "21:00",
  quietEnd: "08:00",
  lastSentAt: null,
  cooldownDays: 90,
  alreadySent: false,
  reviewUrl: "https://g.page/r/example/review",
  businessName: "Brooks Plumbing",
};

describe("review request gate", () => {
  it("sends one review link when the contact is eligible", () => {
    const decision = decideReviewRequest(READY);
    expect(decision.send).toBe(true);
    if (decision.send) {
      expect(decision.messagingServiceSid).toBe("MG123");
      expect(decision.body).toContain("https://g.page/r/example/review");
      expect(decision.body).toContain("STOP");
    }
  });

  it("does not send a second text for the same job", () => {
    const decision = decideReviewRequest({ ...READY, alreadySent: true });
    expect(decision).toEqual({ send: false, reason: "duplicate" });
  });

  it("honors the per-contact cooldown", () => {
    const recent = decideReviewRequest({
      ...READY,
      lastSentAt: new Date("2026-08-01T18:00:00Z"),
    });
    expect(recent).toEqual({ send: false, reason: "cooldown" });

    const cooled = decideReviewRequest({
      ...READY,
      lastSentAt: new Date("2026-01-01T18:00:00Z"),
    });
    expect(cooled.send).toBe(true);
  });

  it("honors opt-out before any other skip reason", () => {
    const decision = decideReviewRequest({
      ...READY,
      optedOut: true,
      alreadySent: true,
    });
    expect(decision).toEqual({ send: false, reason: "opted_out" });
  });

  it("holds the text during quiet hours", () => {
    const night = decideReviewRequest({
      ...READY,
      now: new Date("2026-09-27T03:30:00Z"),
    });
    expect(night).toEqual({ send: false, reason: "quiet_hours" });
  });

  it("refuses a line that is not registered for texting", () => {
    const decision = decideReviewRequest({
      ...READY,
      textingReady: false,
      messagingServiceSid: null,
    });
    expect(decision).toEqual({ send: false, reason: "not_registered" });
  });
});
