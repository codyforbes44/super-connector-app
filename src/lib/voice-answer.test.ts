import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  RECORDING_CONSENT,
  fallbackVoicemailTwiml,
  forwardedCallTwiml,
  recordVerb,
  voicemailTwiml,
} from "./voice-answer.server";

function noticePrecedesRecording(twiml: string) {
  const noticeAt = twiml.indexOf(RECORDING_CONSENT);
  const recordAt = twiml.search(/<Record|\srecord="/);
  expect(noticeAt).toBeGreaterThanOrEqual(0);
  expect(recordAt).toBeGreaterThan(noticeAt);
}

describe("recording notice", () => {
  it("plays the notice immediately before a voicemail recording", () => {
    noticePrecedesRecording(recordVerb());
    noticePrecedesRecording(fallbackVoicemailTwiml());
  });

  it("plays the notice before a forwarded call is recorded, and not otherwise", () => {
    const recorded = forwardedCallTwiml({
      record: true,
      callerId: "+15550001111",
      destination: "+15550002222",
      timeoutSeconds: 24,
    });
    noticePrecedesRecording(recorded);
    expect(recorded).toContain('record="record-from-answer-dual"');

    const plain = forwardedCallTwiml({
      record: false,
      callerId: "+15550001111",
      destination: "+15550002222",
      timeoutSeconds: 24,
    });
    expect(plain).not.toMatch(/<Record|\srecord="/);
    expect(plain).not.toContain(RECORDING_CONSENT);
  });

  it("includes the notice on the voicemail answer path", async () => {
    const twiml = await voicemailTwiml(
      {} as never,
      { answer_mode: "voicemail" },
      { callSid: "CA1", from: "+15551111", appNumber: "+15552222" },
    );
    noticePrecedesRecording(twiml);
  });

  it("keeps recording verbs in the shared helper, not the webhook routes", () => {
    for (const file of ["voice.ts", "voice-fallback.ts", "app-voice.ts"]) {
      const source = readFileSync(
        new URL(`../routes/api/public/twilio/${file}`, import.meta.url),
        "utf8",
      );
      expect(source).not.toContain("<Record");
      expect(source).not.toContain('record="');
    }
  });
});

describe("recording claims", () => {
  it("does not say live calls are never recorded", () => {
    const files = [
      "../routes/index.tsx",
      "../routes/features.tsx",
      "../routes/faq.tsx",
      "../routes/legal/privacy.tsx",
    ];
    for (const file of files) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8").replace(/\s+/g, " ");
      expect(source).not.toMatch(/never recorded|never records live|does not record live/i);
      expect(source).toContain(
        "Calls are only recorded if you turn on transcription for a line, and callers hear a recording notice first.",
      );
    }
  });
});
