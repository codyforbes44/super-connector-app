/**
 * Gate for every automated SMS (missed-call text-back today; Phase 2 quiet hours
 * and the opt-out table plug in through `registerAutomatedTextCheck`).
 *
 * At minimum this honors `conversations.opted_out`, which STOP sets in the SMS webhook.
 */

import { normalizePhone } from "./twilio.server";

export type AutomatedTextBlock =
  "short_code" | "self" | "invalid_destination" | "opted_out" | "unregistered";

export type AutomatedTextVerdict =
  { ok: true; messagingServiceSid: string } | { ok: false; reason: AutomatedTextBlock | string };

const ANONYMOUS = /^(anonymous|restricted|unavailable|unknown|private|withheld)$/i;

export type AutomatedTextCheck = (
  to: string,
  from: string,
) => Promise<string | null> | string | null;

const extraChecks: AutomatedTextCheck[] = [];

/** Phase 2 registers opt-out-table and quiet-hours checks here. Return a reason to block. */
export function registerAutomatedTextCheck(check: AutomatedTextCheck): void {
  extraChecks.push(check);
}

export function resetAutomatedTextChecksForTests(): void {
  extraChecks.length = 0;
}

export function campaignReady(status: string | null | undefined): boolean {
  const value = (status ?? "").toUpperCase();
  return value === "VERIFIED" || value === "APPROVED" || value === "REGISTERED";
}

export function evaluateAutomatedText(input: {
  to: string;
  from: string;
  optedOut: boolean;
  messagingServiceSid: string | null;
  campaignReady: boolean;
}): AutomatedTextVerdict {
  const rawTo = input.to.trim();
  if (!rawTo || ANONYMOUS.test(rawTo)) return { ok: false, reason: "invalid_destination" };
  const toDigits = rawTo.replace(/\D/g, "");
  const fromDigits = input.from.replace(/\D/g, "");
  if (!toDigits) return { ok: false, reason: "invalid_destination" };
  if (toDigits.length <= 6) return { ok: false, reason: "short_code" };
  if (toDigits.length < 10) return { ok: false, reason: "invalid_destination" };
  if (toDigits === fromDigits) return { ok: false, reason: "self" };
  if (input.optedOut) return { ok: false, reason: "opted_out" };
  if (!input.messagingServiceSid || !input.campaignReady)
    return { ok: false, reason: "unregistered" };
  return { ok: true, messagingServiceSid: input.messagingServiceSid };
}

export async function applyAutomatedTextChecks(
  to: string,
  from: string,
  verdict: AutomatedTextVerdict,
): Promise<AutomatedTextVerdict> {
  if (!verdict.ok) return verdict;
  const contact = normalizePhone(to);
  const line = normalizePhone(from);
  for (const check of extraChecks) {
    const reason = await check(contact, line);
    if (reason) return { ok: false, reason };
  }
  return verdict;
}

export const UNREGISTERED_TEXTING_COPY = "This line isn't registered for texting yet.";
