/**
 * Signed outbound webhooks. The body is `${timestamp}.${rawJson}` HMAC-SHA256,
 * hex, prefixed `v1=`. Receivers reject timestamps outside the replay window.
 */

export const OUTBOUND_EVENT_TYPES = [
  "call.missed",
  "call.completed",
  "voicemail.transcribed",
  "lead.captured",
  "booking.created",
  "message.received",
] as const;

export type OutboundEventType = (typeof OUTBOUND_EVENT_TYPES)[number];

export const SIGNATURE_HEADER = "X-SixVox-Signature";
export const TIMESTAMP_HEADER = "X-SixVox-Timestamp";
export const REPLAY_WINDOW_SECONDS = 300;

/** Seconds to wait after each failure. Null means the delivery is dead. */
export const RETRY_BACKOFF_SECONDS = [60, 300, 1800, 7200, 21600] as const;

export function isOutboundEventType(value: string): value is OutboundEventType {
  return (OUTBOUND_EVENT_TYPES as readonly string[]).includes(value);
}

export function eventLabel(type: OutboundEventType): string {
  switch (type) {
    case "call.missed":
      return "Call missed";
    case "call.completed":
      return "Call completed";
    case "voicemail.transcribed":
      return "Voicemail transcribed";
    case "lead.captured":
      return "Lead captured";
    case "booking.created":
      return "Booking created";
    case "message.received":
      return "Message received";
    default: {
      const neverType: never = type;
      return neverType;
    }
  }
}

export function assertPublicWebhookUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Enter a valid webhook URL.");
  }
  if (url.protocol !== "https:") throw new Error("Webhook URL must start with https://.");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.startsWith("127.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    throw new Error("Webhook URL must be a public https address.");
  }
  return url;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function signWebhookBody(
  secret: string,
  timestamp: string,
  body: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  return `v1=${bytesToHex(new Uint8Array(mac))}`;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyWebhookSignature(input: {
  secret: string;
  timestamp: string;
  signature: string;
  body: string;
  nowSeconds?: number;
  windowSeconds?: number;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const windowSeconds = input.windowSeconds ?? REPLAY_WINDOW_SECONDS;
  const stamped = Number(input.timestamp);
  if (!Number.isFinite(stamped)) return { ok: false, reason: "invalid timestamp" };
  if (Math.abs(now - stamped) > windowSeconds)
    return { ok: false, reason: "timestamp outside replay window" };
  const expected = await signWebhookBody(input.secret, input.timestamp, input.body);
  const presented = input.signature.trim();
  if (!timingSafeEqual(expected, presented)) return { ok: false, reason: "signature mismatch" };
  return { ok: true };
}

/**
 * Delay before the next attempt after `failedAttempts` failures.
 * The first attempt is immediate (callers pass 0 only for the initial try).
 * After the backoff list is exhausted, returns null and the delivery is dead.
 */
export function retryDelaySeconds(failedAttempts: number): number | null {
  if (failedAttempts < 1) return 0;
  const delay = RETRY_BACKOFF_SECONDS[failedAttempts - 1];
  return delay === undefined ? null : delay;
}

export function nextRetryAt(failedAttempts: number, now: Date): Date | null {
  const delay = retryDelaySeconds(failedAttempts);
  if (delay === null) return null;
  return new Date(now.getTime() + delay * 1000);
}

export function endpointReceivesEvent(
  endpointWorkspaceId: string | null,
  eventWorkspaceId: string | null,
): boolean {
  return endpointWorkspaceId === eventWorkspaceId;
}

export function sampleEventData(type: OutboundEventType): Record<string, unknown> {
  switch (type) {
    case "call.missed":
      return {
        call_sid: "CA_test_missed",
        from: "+15555550100",
        to: "+15807450045",
        app_number: "+15807450045",
        status: "no-answer",
        test: true,
      };
    case "call.completed":
      return {
        call_sid: "CA_test_completed",
        from: "+15555550100",
        to: "+15807450045",
        app_number: "+15807450045",
        status: "completed",
        duration: 42,
        test: true,
      };
    case "voicemail.transcribed":
      return {
        call_sid: "CA_test_voicemail",
        from: "+15555550100",
        app_number: "+15807450045",
        transcript: "Hi, this is a test voicemail.",
        test: true,
      };
    case "lead.captured":
      return {
        name: "Test Lead",
        email: "lead@example.com",
        company: "Example Plumbing",
        message: "Test lead from SixVox.",
        source: "test",
        test: true,
      };
    case "booking.created":
      return {
        event_id: "evt_test",
        app_number: "+15807450045",
        summary: "Test booking",
        starts_at: "2026-09-28T15:00:00.000Z",
        ends_at: "2026-09-28T15:30:00.000Z",
        test: true,
      };
    case "message.received":
      return {
        message_sid: "SM_test",
        from: "+15555550100",
        to: "+15807450045",
        body: "Test inbound message",
        channel: "sms",
        test: true,
      };
    default: {
      const neverType: never = type;
      return { type: neverType };
    }
  }
}
