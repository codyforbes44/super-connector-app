import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { AI_IDENTITY, composeAiFirstMessage } from "./compliance/recording-copy";
import {
  RECORDING_CONSENT,
  aiHandoffTwiml,
  bridgeCallTwiml,
  fallbackVoicemailTwiml,
  forwardedCallTwiml,
  inboundClientDialTwiml,
  outboundAppDialTwiml,
  recordVerb,
  recordingNoticeResponseTwiml,
  voicemailTwiml,
} from "./voice-answer.server";

const RECORDING_CLAIM =
  "Call recording is off for each line until you turn it on. When it is on, everyone on the call hears a recording notice before recording starts, including voicemail and the AI receptionist.";

function noticePrecedesRecordVerb(twiml: string) {
  const noticeAt = twiml.indexOf(RECORDING_CONSENT);
  const recordAt = twiml.indexOf("<Record");
  expect(noticeAt).toBeGreaterThanOrEqual(0);
  expect(recordAt).toBeGreaterThan(noticeAt);
}

function liveRecordingStartsWithNotice(twiml: string) {
  const start = twiml.indexOf("<Start><Recording");
  const notice = twiml.indexOf(RECORDING_CONSENT);
  const dial = twiml.indexOf("<Dial");
  expect(start).toBeGreaterThanOrEqual(0);
  expect(notice).toBeGreaterThan(start);
  expect(dial).toBeGreaterThan(notice);
  expect(twiml).toContain('channels="dual"');
  expect(twiml).toContain("/api/public/twilio/recording-notice");
  expect(twiml).not.toMatch(/\srecord="/);
}

describe("recording notice", () => {
  it("plays the notice immediately before a voicemail recording", () => {
    noticePrecedesRecordVerb(recordVerb());
    noticePrecedesRecordVerb(fallbackVoicemailTwiml());
  });

  it("starts a forwarded recording with the notice, and stays silent when recording is off", () => {
    const recorded = forwardedCallTwiml({
      record: true,
      callerId: "+15550001111",
      destination: "+15550002222",
      timeoutSeconds: 24,
    });
    liveRecordingStartsWithNotice(recorded);

    const plain = forwardedCallTwiml({
      record: false,
      callerId: "+15550001111",
      destination: "+15550002222",
      timeoutSeconds: 24,
    });
    expect(plain).not.toMatch(/<Record|<Start>|\srecord="/);
    expect(plain).not.toContain(RECORDING_CONSENT);
    expect(plain).toContain("/api/public/twilio/dial-action");
  });

  it("starts outbound, inbound, and bridge recordings with the notice", () => {
    liveRecordingStartsWithNotice(
      outboundAppDialTwiml({
        record: true,
        callerId: "+15550001111",
        destination: "+15550002222",
        actionUrl: "https://sixvox.3bi.io/api/public/twilio/status",
      }),
    );
    liveRecordingStartsWithNotice(
      inboundClientDialTwiml({
        record: true,
        callerId: "+15550001111",
        timeoutSeconds: 24,
        actionUrl: "https://sixvox.3bi.io/api/public/twilio/status",
        clientIdentities: ["user-1"],
      }),
    );
    liveRecordingStartsWithNotice(
      bridgeCallTwiml({
        record: true,
        callerId: "+15550001111",
        destination: "+15550002222",
      }),
    );
    const quiet = outboundAppDialTwiml({
      record: false,
      callerId: "+15550001111",
      destination: "+15550002222",
      actionUrl: "https://sixvox.3bi.io/api/public/twilio/status",
    });
    expect(quiet).not.toContain(RECORDING_CONSENT);
    expect(quiet).not.toContain("<Start>");
  });

  it("identifies the AI and adds the notice only when the line records", () => {
    const plain = aiHandoffTwiml({
      record: false,
      redirectUrl: "https://api.elevenlabs.io/twilio/inbound",
    });
    expect(plain.indexOf(AI_IDENTITY)).toBeGreaterThanOrEqual(0);
    expect(plain).not.toContain(RECORDING_CONSENT);
    expect(plain).toContain("<Redirect");
    expect(plain).not.toContain("<Start>");

    const recorded = aiHandoffTwiml({
      record: true,
      redirectUrl: "https://api.elevenlabs.io/twilio/inbound",
    });
    const start = recorded.indexOf("<Start><Recording");
    const notice = recorded.indexOf(RECORDING_CONSENT);
    const identity = recorded.indexOf(AI_IDENTITY);
    const redirect = recorded.indexOf("<Redirect");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(notice).toBeGreaterThan(start);
    expect(identity).toBeGreaterThan(notice);
    expect(redirect).toBeGreaterThan(identity);
  });

  it("whispers the same notice to the other party", () => {
    expect(recordingNoticeResponseTwiml()).toContain(RECORDING_CONSENT);
    expect(recordingNoticeResponseTwiml()).not.toContain("<Record");
  });

  it("includes the notice on the voicemail answer path", async () => {
    const twiml = await voicemailTwiml(
      {} as never,
      { answer_mode: "voicemail" },
      { callSid: "CA1", from: "+15551111", appNumber: "+15552222" },
    );
    noticePrecedesRecordVerb(twiml);
  });

  it("keeps recording verbs in the shared helper, not the webhook routes", () => {
    for (const file of ["voice.ts", "voice-fallback.ts", "app-voice.ts"]) {
      const source = readFileSync(
        new URL(`../routes/api/public/twilio/${file}`, import.meta.url),
        "utf8",
      );
      expect(source).not.toContain("<Record");
      expect(source).not.toContain('record="');
      expect(source).not.toContain("<Start>");
    }
    const notice = readFileSync(
      new URL("../routes/api/public/twilio/recording-notice.ts", import.meta.url),
      "utf8",
    );
    expect(notice).toContain("verifyTwilioWebhook");
  });

  it("puts the assistant identity and the notice into the stored first message", () => {
    const recorded = composeAiFirstMessage("How can I help?", true);
    expect(recorded.startsWith(AI_IDENTITY)).toBe(true);
    expect(recorded).toContain(RECORDING_CONSENT);
    const cleared = composeAiFirstMessage(recorded, false);
    expect(cleared).toContain(AI_IDENTITY);
    expect(cleared).not.toContain(RECORDING_CONSENT);
    expect(cleared).toContain("How can I help?");
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
      expect(source).toContain(RECORDING_CLAIM);
    }
  });
});
