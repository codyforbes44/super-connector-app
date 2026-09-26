import { describe, expect, it } from "vitest";

import {
  isDuplicateTextBack,
  isUnansweredCall,
  missedCallTextDecision,
  type MissedCallFacts,
} from "./missed-call";

function facts(overrides: Partial<MissedCallFacts> = {}): MissedCallFacts {
  return {
    direction: "inbound",
    callStatus: "completed",
    dialStatus: null,
    answerPath: null,
    durationSeconds: null,
    hasAiConversation: false,
    hasVoicemailRecording: false,
    ringSeconds: 24,
    textBackOnAi: false,
    textBackOnVoicemail: false,
    ...overrides,
  };
}

describe("missed-call detection", () => {
  it.each(["no-answer", "busy", "failed", "canceled"] as const)(
    "texts when DialCallStatus is %s",
    (dialStatus) => {
      const input = facts({ dialStatus, callStatus: "completed" });
      expect(isUnansweredCall(input)).toBe(true);
      expect(missedCallTextDecision({ ...input, enabled: true })).toEqual({
        send: true,
        reason: "unanswered_dial",
      });
    },
  );

  it.each(["completed", "answered"] as const)(
    "does not text when the dial was %s",
    (dialStatus) => {
      const input = facts({ dialStatus, durationSeconds: 40 });
      expect(isUnansweredCall(input)).toBe(false);
      expect(missedCallTextDecision({ ...input, enabled: true })).toEqual({
        send: false,
        reason: "answered",
      });
    },
  );

  it("texts parent no-answer, busy, failed, and canceled statuses", () => {
    for (const callStatus of ["no-answer", "busy", "failed", "canceled"] as const) {
      const input = facts({ callStatus });
      expect(missedCallTextDecision({ ...input, enabled: true }).send).toBe(true);
    }
  });

  it("treats a hangup during ringback as unanswered when an answer path is set", () => {
    const input = facts({ callStatus: "completed", answerPath: "ai_agent", durationSeconds: 10 });
    expect(isUnansweredCall(input)).toBe(true);
    expect(missedCallTextDecision({ ...input, enabled: true }).reason).toBe(
      "abandoned_during_ring",
    );
  });

  it("does not treat a short completed call with no answer path as missed", () => {
    const input = facts({ callStatus: "completed", answerPath: null, durationSeconds: 8 });
    expect(isUnansweredCall(input)).toBe(false);
    expect(missedCallTextDecision({ ...input, enabled: true }).reason).toBe("not_missed");
  });

  it("skips AI and voicemail unless the owner opts in", () => {
    const ai = facts({
      callStatus: "completed",
      answerPath: "ai_agent",
      durationSeconds: 90,
      hasAiConversation: true,
    });
    expect(isUnansweredCall(ai)).toBe(false);
    expect(missedCallTextDecision({ ...ai, enabled: true }).reason).toBe("ai_handled");
    expect(missedCallTextDecision({ ...ai, enabled: true, textBackOnAi: true }).reason).toBe(
      "opt_in_ai",
    );

    const voicemail = facts({
      callStatus: "completed",
      answerPath: "voicemail",
      durationSeconds: 40,
      hasVoicemailRecording: true,
    });
    expect(missedCallTextDecision({ ...voicemail, enabled: true }).reason).toBe(
      "voicemail_handled",
    );
    expect(
      missedCallTextDecision({ ...voicemail, enabled: true, textBackOnVoicemail: true }).reason,
    ).toBe("opt_in_voicemail");
  });

  it("stays quiet while the call is still ringing and when text-back is off", () => {
    expect(
      missedCallTextDecision({ ...facts({ callStatus: "ringing" }), enabled: true }).reason,
    ).toBe("in_progress");
    expect(
      missedCallTextDecision({ ...facts({ dialStatus: "no-answer" }), enabled: false }).reason,
    ).toBe("disabled");
    expect(
      missedCallTextDecision({
        ...facts({ direction: "outbound", dialStatus: "no-answer" }),
        enabled: true,
      }).reason,
    ).toBe("outbound");
  });
});

describe("text-back dedupe", () => {
  const now = new Date("2026-09-26T15:00:00.000Z");

  it("blocks a second text inside the window and allows one after it", () => {
    const recent = new Date(now.getTime() - 30 * 60_000);
    const older = new Date(now.getTime() - 61 * 60_000);
    expect(isDuplicateTextBack(recent, now, 60)).toBe(true);
    expect(isDuplicateTextBack(older, now, 60)).toBe(false);
    expect(isDuplicateTextBack(null, now, 60)).toBe(false);
  });
});
