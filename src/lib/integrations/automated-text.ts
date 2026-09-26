/**
 * Review and payment-link policy on top of the shared automated-text gate.
 * Opt-out, campaign readiness, quiet hours, and consent are decided by
 * `evaluateAutomatedText`. Cooldown and duplicate review sends stay here.
 */

import { evaluateAutomatedText, type AutomatedTextKind } from "@/lib/automated-text";
import { isQuietHours as quietHoursNow, type QuietHours } from "@/lib/compliance/opt-out";

/** The only line with a verified A2P campaign today. Other lines must not text. */
export const REGISTERED_TEXTING_E164 = "+15807450045";

export const DEFAULT_QUIET_START = "21:00";
export const DEFAULT_QUIET_END = "08:00";
export const DEFAULT_QUIET_TIMEZONE = "America/Chicago";
export const DEFAULT_REVIEW_COOLDOWN_DAYS = 90;

export type AutomatedBlockReason =
  "opted_out" | "not_registered" | "duplicate" | "cooldown" | "quiet_hours" | "no_consent";

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
  to?: string;
  from?: string;
  kind?: AutomatedTextKind;
  /** Latest review/marketing consent row. Omitted means the caller already allowed it. */
  hasConsent?: boolean;
  /** Owner quiet-hours window from the compliance settings, already evaluated. */
  complianceQuietHours?: boolean;
};

/** Quiet window may cross midnight (21:00–08:00). Uses the compliance clock. */
export function isQuietHours(
  now: Date,
  timezone: string,
  quietStart: string,
  quietEnd: string,
): boolean {
  const row: QuietHours = {
    enabled: true,
    quietStart,
    quietEnd,
    timezone,
  };
  return quietHoursNow(row, now);
}

function blockReason(reason: string): AutomatedBlockReason {
  if (reason === "opted_out" || reason === "quiet_hours" || reason === "no_consent") return reason;
  return "not_registered";
}

export function canSendAutomatedText(input: AutomatedSendInput): AutomatedSendDecision {
  const kind = input.kind ?? "automated";
  const windowQuiet =
    input.enforceQuietHours &&
    isQuietHours(
      input.now,
      input.timezone || DEFAULT_QUIET_TIMEZONE,
      input.quietStart || DEFAULT_QUIET_START,
      input.quietEnd || DEFAULT_QUIET_END,
    );
  const shared = evaluateAutomatedText({
    to: input.to ?? "+15555550123",
    from: input.from ?? REGISTERED_TEXTING_E164,
    optedOut: input.optedOut,
    messagingServiceSid: input.messagingServiceSid,
    campaignReady: input.textingReady,
    quietHours: windowQuiet || Boolean(input.complianceQuietHours),
    kind,
    hasConsent: input.hasConsent ?? true,
  });
  if (!shared.ok) return { allow: false, reason: blockReason(shared.reason) };
  if (input.alreadySent) return { allow: false, reason: "duplicate" };

  const cooldownDays = input.cooldownDays ?? 0;
  if (input.lastSentAt && cooldownDays > 0) {
    const elapsed = input.now.getTime() - input.lastSentAt.getTime();
    if (elapsed < cooldownDays * 24 * 60 * 60 * 1000) {
      return { allow: false, reason: "cooldown" };
    }
  }

  return { allow: true, messagingServiceSid: shared.messagingServiceSid };
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
