/**
 * Single gate for automated SMS (review requests and payment links).
 *
 * Phase 2 compliance and Phase 4a own the long-term helper of the same name
 * (opt-out, quiet hours, consent). Every automated send in this feature calls
 * `canSendAutomatedText` and nothing else decides whether a text may go out.
 * When that shared helper lands, replace this module and keep the call sites.
 */

/** The only line with a verified A2P campaign today. Other lines must not text. */
export const REGISTERED_TEXTING_E164 = "+15807450045";

export const DEFAULT_QUIET_START = "21:00";
export const DEFAULT_QUIET_END = "08:00";
export const DEFAULT_QUIET_TIMEZONE = "America/Chicago";
export const DEFAULT_REVIEW_COOLDOWN_DAYS = 90;

export type AutomatedBlockReason =
  "opted_out" | "not_registered" | "duplicate" | "cooldown" | "quiet_hours";

export type AutomatedSendDecision =
  { allow: true; messagingServiceSid: string } | { allow: false; reason: AutomatedBlockReason };

export type AutomatedSendInput = {
  optedOut: boolean;
  messagingServiceSid: string | null;
  textingReady: boolean;
  now: Date;
  enforceQuietHours: boolean;
  timezone?: string | null;
  quietStart?: string | null;
  quietEnd?: string | null;
  lastSentAt?: Date | null;
  cooldownDays?: number | null;
  alreadySent?: boolean;
};

function minutesInZone(now: Date, timezone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const minute = Number(parts.find((part) => part.type === "minute")?.value);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return hour * 60 + minute;
  } catch {
    return null;
  }
}

function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

/** Quiet window may cross midnight (21:00–08:00). */
export function isQuietHours(
  now: Date,
  timezone: string,
  quietStart: string,
  quietEnd: string,
): boolean {
  const start = parseClock(quietStart);
  const end = parseClock(quietEnd);
  const current = minutesInZone(now, timezone);
  if (start === null || end === null || current === null || start === end) return false;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

export function canSendAutomatedText(input: AutomatedSendInput): AutomatedSendDecision {
  if (input.optedOut) return { allow: false, reason: "opted_out" };
  if (!input.textingReady || !input.messagingServiceSid) {
    return { allow: false, reason: "not_registered" };
  }
  if (input.alreadySent) return { allow: false, reason: "duplicate" };

  const cooldownDays = input.cooldownDays ?? 0;
  if (input.lastSentAt && cooldownDays > 0) {
    const elapsed = input.now.getTime() - input.lastSentAt.getTime();
    if (elapsed < cooldownDays * 24 * 60 * 60 * 1000) {
      return { allow: false, reason: "cooldown" };
    }
  }

  if (input.enforceQuietHours) {
    const quiet = isQuietHours(
      input.now,
      input.timezone || DEFAULT_QUIET_TIMEZONE,
      input.quietStart || DEFAULT_QUIET_START,
      input.quietEnd || DEFAULT_QUIET_END,
    );
    if (quiet) return { allow: false, reason: "quiet_hours" };
  }

  return { allow: true, messagingServiceSid: input.messagingServiceSid };
}

export function reviewRequestBody(input: {
  businessName?: string | null | undefined;
  reviewUrl: string;
}): string {
  const name = input.businessName?.trim() || "us";
  return `Thanks for choosing ${name}. If you have a minute, a Google review helps neighbors find a local pro: ${input.reviewUrl.trim()}\nReply STOP to opt out.`;
}

export function paymentLinkBody(input: {
  description: string;
  url: string;
  amountLabel: string;
}): string {
  return `${input.amountLabel} — ${input.description.trim()}\nPay here: ${input.url}\nReply STOP to opt out.`;
}

export function notRegisteredCopy(phone: string | null | undefined): string {
  const which = phone ? `${phone} is` : "This line is";
  return `${which} not registered for texting. Only ${REGISTERED_TEXTING_E164} can send texts today, and only through its Messaging Service.`;
}
