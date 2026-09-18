/**
 * Pure "is this Twilio number fully wired to SixVox?" heuristic.
 *
 * A number is only fully wired when voice, SMS and status callbacks all land
 * somewhere we control (or on a documented, intentional third party). The old
 * check looked at the SMS URL alone, so numbers whose texting is owned by a
 * Messaging Service reported a false "0 fully wired".
 *
 * No I/O here on purpose — callers pass in what they already read from Twilio.
 */

/** Hosts that are us: production plus Lovable preview builds. */
const OWN_HOSTS = ["sixvox.3bi.io", "lovable.app", "lovableproject.com"];

/** Documented intentional third party: ElevenLabs native inbound calling. */
const ELEVENLABS_HOST = "elevenlabs.io";
const ELEVENLABS_INBOUND_PATH = "/twilio/inbound_call";

function parts(url: string | null | undefined): { host: string; path: string } | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return { host: parsed.hostname.toLowerCase(), path: parsed.pathname };
  } catch {
    return null;
  }
}

function isOwnHost(host: string): boolean {
  return OWN_HOSTS.some((own) => host === own || host.endsWith(`.${own}`));
}

/** True when the URL is one of our own endpoints containing any of `paths`. */
export function pointsAtSixVox(url: string | null | undefined, paths: string[]): boolean {
  const p = parts(url);
  if (!p || !isOwnHost(p.host)) return false;
  return paths.some((path) => p.path.includes(path));
}

/** True when the URL is the ElevenLabs native inbound-call endpoint. */
export function pointsAtElevenLabsInbound(url: string | null | undefined): boolean {
  const p = parts(url);
  if (!p) return false;
  return (
    (p.host === ELEVENLABS_HOST || p.host.endsWith(`.${ELEVENLABS_HOST}`)) &&
    p.path.includes(ELEVENLABS_INBOUND_PATH)
  );
}

export type WiringPayload = {
  /** Number-level VoiceUrl from Twilio. */
  voice_url?: string | null;
  /** Number-level SmsUrl from Twilio. */
  sms_url?: string | null;
  /** An SMS app SID shadows SmsUrl, so it is never sufficient on its own. */
  sms_application_sid?: string | null;
  /** Number-level StatusCallback from Twilio. */
  status_callback?: string | null;
  /** SixVox answer mode for this number ("ai_agent" allows EL-primary voice). */
  answer_mode?: string | null;
  /** The number sits in a Messaging Service whose inbound URL points at us. */
  messaging_service_inbound_ok?: boolean | null;
  /** Operator flagged texting as intentionally owned by an outside system. */
  external_sms?: boolean | null;
};

export type WiringReport = {
  voice: boolean;
  sms: boolean;
  status: boolean;
  /** SMS is handled elsewhere on purpose — honest copy, not a failure. */
  smsExternal: boolean;
  /** Voice is answered by ElevenLabs directly rather than by our webhook. */
  voiceElevenLabs: boolean;
  wired: boolean;
  /** Short human reason when not fully wired. */
  reason: string | null;
};

export function wiringReport(n: WiringPayload): WiringReport {
  const aiPrimary = (n.answer_mode ?? "") === "ai_agent";
  const voiceElevenLabs = aiPrimary && pointsAtElevenLabsInbound(n.voice_url);
  const voice =
    pointsAtSixVox(n.voice_url, ["/api/public/twilio/voice", "/api/public/twilio/app-voice"]) ||
    voiceElevenLabs;

  const smsExternal = Boolean(n.external_sms);
  const smsOwnUrl =
    !n.sms_application_sid && pointsAtSixVox(n.sms_url, ["/api/public/twilio/sms"]);
  const sms = smsOwnUrl || Boolean(n.messaging_service_inbound_ok) || smsExternal;

  const status =
    pointsAtSixVox(n.status_callback, ["/api/public/twilio/status"]) ||
    (voiceElevenLabs && Boolean(n.status_callback));

  const wired = voice && sms && status;
  const missing: string[] = [];
  if (!voice) missing.push("voice");
  if (!sms) missing.push("texting");
  if (!status) missing.push("status callback");

  return {
    voice,
    sms,
    status,
    smsExternal,
    voiceElevenLabs,
    wired,
    reason: wired ? null : `${missing.join(" and ")} not routed to SixVox`,
  };
}

export function isFullyWired(n: WiringPayload): boolean {
  return wiringReport(n).wired;
}
