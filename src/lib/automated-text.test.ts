import { describe, expect, it } from "vitest";

import {
  applyAutomatedTextChecks,
  evaluateAutomatedText,
  registerAutomatedTextCheck,
  resetAutomatedTextChecksForTests,
} from "./automated-text";
import { canSendAutomatedText, sendAutomatedText } from "./automated-text.server";

const registered = {
  to: "+15555550123",
  from: "+15807450045",
  optedOut: false,
  messagingServiceSid: "MG123",
  campaignReady: true,
};

describe("unregistered-line guard", () => {
  it("blocks lines with no messaging service or an unverified campaign", () => {
    expect(evaluateAutomatedText({ ...registered, messagingServiceSid: null })).toEqual({
      ok: false,
      reason: "unregistered",
    });
    expect(evaluateAutomatedText({ ...registered, campaignReady: false })).toEqual({
      ok: false,
      reason: "unregistered",
    });
  });

  it("blocks short codes, the line itself, and opted-out callers", () => {
    expect(evaluateAutomatedText({ ...registered, to: "12345" })).toEqual({
      ok: false,
      reason: "short_code",
    });
    expect(evaluateAutomatedText({ ...registered, to: "+15807450045" })).toEqual({
      ok: false,
      reason: "self",
    });
    expect(evaluateAutomatedText({ ...registered, to: "anonymous" })).toEqual({
      ok: false,
      reason: "invalid_destination",
    });
    expect(evaluateAutomatedText({ ...registered, optedOut: true })).toEqual({
      ok: false,
      reason: "opted_out",
    });
  });

  it("does not call Twilio when the line is unregistered", async () => {
    let called = false;
    const result = await sendAutomatedText({
      to: "+15555550123",
      from: "+15807450045",
      body: "Sorry we missed you",
      deps: { optedOut: false, messagingServiceSid: null, campaignReady: false },
      send: async () => {
        called = true;
        return { sid: "SM1", status: "queued" };
      },
    });
    expect(result).toEqual({ ok: false, reason: "unregistered" });
    expect(called).toBe(false);
  });

  it("honors an injected opted-out flag and a Phase 2 check", async () => {
    const opted = await canSendAutomatedText("+15555550123", "+15807450045", {
      optedOut: true,
      messagingServiceSid: "MG123",
      campaignReady: true,
    });
    expect(opted).toEqual({ ok: false, reason: "opted_out" });

    resetAutomatedTextChecksForTests();
    registerAutomatedTextCheck(() => "quiet_hours");
    const quiet = await applyAutomatedTextChecks(
      "+15555550123",
      "+15807450045",
      evaluateAutomatedText(registered),
    );
    expect(quiet).toEqual({ ok: false, reason: "quiet_hours" });
    const stillBlocked = await applyAutomatedTextChecks("+15555550123", "+15807450045", {
      ok: false,
      reason: "unregistered",
    });
    expect(stillBlocked).toEqual({ ok: false, reason: "unregistered" });
    resetAutomatedTextChecksForTests();
  });
});
