import { describe, expect, it } from "vitest";

import { parseCallSidBody, parsePresenceBody, parseVoiceTokenBody } from "./mobile-api-parse";

describe("mobile API parsers", () => {
  it("defaults iOS to the production push environment", () => {
    expect(parseVoiceTokenBody({ platform: "ios" })).toEqual({
      platform: "ios",
      environment: "production",
    });
  });

  it("keeps an explicit iOS sandbox", () => {
    expect(parseVoiceTokenBody({ platform: "ios", environment: "sandbox" })).toEqual({
      platform: "ios",
      environment: "sandbox",
    });
  });

  it("forces Android onto the single FCM credential", () => {
    expect(parseVoiceTokenBody({ platform: "android", environment: "sandbox" })).toEqual({
      platform: "android",
      environment: "production",
    });
  });

  it("rejects an unknown platform", () => {
    expect(parseVoiceTokenBody({ platform: "web" })).toEqual({
      error: "platform must be ios or android.",
    });
  });

  it("requires a device id for presence", () => {
    expect(parsePresenceBody({ online: true, platform: "ios", deviceId: "  " })).toMatchObject({
      error: expect.stringMatching(/deviceId/),
    });
    expect(parsePresenceBody({ online: false, platform: "android", deviceId: "pixel-1" })).toEqual({
      online: false,
      platform: "android",
      deviceId: "pixel-1",
    });
  });

  it("requires a real call SID for an ack", () => {
    expect(parseCallSidBody({ callSid: "nope" })).toMatchObject({ error: expect.any(String) });
    const callSid = "CA" + "1".repeat(32);
    expect(parseCallSidBody({ callSid })).toEqual({ callSid });
  });
});
