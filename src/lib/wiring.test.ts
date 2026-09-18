import { describe, expect, it } from "vitest";

import { isFullyWired } from "./wiring";

const base = {
  voice_url: "https://sixvox.3bi.io/api/public/twilio/voice?t=x",
  sms_url: "https://sixvox.3bi.io/api/public/twilio/sms?t=x",
  status_callback: "https://sixvox.3bi.io/api/public/twilio/status?t=x",
};

describe("isFullyWired", () => {
  it("accepts all three SixVox webhooks", () => {
    expect(isFullyWired(base)).toBe(true);
  });

  it("accepts the in-app voice webhook", () => {
    expect(
      isFullyWired({ ...base, voice_url: "https://sixvox.3bi.io/api/public/twilio/app-voice" }),
    ).toBe(true);
  });

  it("accepts SMS owned by a Messaging Service that points at us", () => {
    expect(isFullyWired({ ...base, sms_url: null, messaging_service_inbound_ok: true })).toBe(true);
  });

  it("accepts intentionally external texting", () => {
    expect(isFullyWired({ ...base, sms_url: null, external_sms: true })).toBe(true);
  });

  it("rejects an SMS application SID as sufficient", () => {
    expect(isFullyWired({ ...base, sms_application_sid: "AP123" })).toBe(false);
  });

  it("accepts ElevenLabs inbound voice only in ai_agent mode", () => {
    const el = {
      ...base,
      voice_url: "https://api.us.elevenlabs.io/twilio/inbound_call",
    };
    expect(isFullyWired({ ...el, answer_mode: "ai_agent" })).toBe(true);
    expect(isFullyWired({ ...el, answer_mode: "voicemail" })).toBe(false);
  });

  it("rejects an off-site voice or status URL", () => {
    expect(isFullyWired({ ...base, voice_url: "https://example.com/voice" })).toBe(false);
    expect(isFullyWired({ ...base, status_callback: null })).toBe(false);
  });
});
