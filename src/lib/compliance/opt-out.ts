/**
 * TCPA opt-out, quiet hours, and marketing consent.
 * Keyword lists match Twilio's default US long-code set plus HELP/INFO.
 */

export const STOP_WORDS = [
  "stop",
  "stopall",
  "unsubscribe",
  "cancel",
  "end",
  "quit",
  "revoke",
  "optout",
] as const;

export const START_WORDS = ["start", "unstop", "yes", "optin"] as const;

export const HELP_WORDS = ["help", "info"] as const;

export type KeywordSignal = "stop" | "start" | "help";

export type SendKind = "manual" | "automated" | "review" | "marketing";

export function keywordSignal(body: string): KeywordSignal | null {
  const word = body
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (!word) return null;
  if ((STOP_WORDS as readonly string[]).includes(word)) return "stop";
  if ((START_WORDS as readonly string[]).includes(word)) return "start";
  if ((HELP_WORDS as readonly string[]).includes(word)) return "help";
  return null;
}

/** Prefer Twilio's OptOutType when Advanced Opt-Out already classified the text. */
export function signalFromOptOutType(optOutType: string | null | undefined): KeywordSignal | null {
  const value = (optOutType ?? "").trim().toUpperCase();
  if (value === "STOP") return "stop";
  if (value === "START") return "start";
  if (value === "HELP") return "help";
  return null;
}

export function resolveInboundSignal(
  body: string,
  optOutType: string | null | undefined,
): KeywordSignal | null {
  return signalFromOptOutType(optOutType) ?? keywordSignal(body);
}

export type QuietHours = {
  enabled: boolean;
  quietStart: string;
  quietEnd: string;
  timezone: string;
};

export function isQuietHours(row: QuietHours, now = new Date()): boolean {
  if (!row.enabled) return false;
  let local: string;
  try {
    local = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: row.timezone || "UTC",
    }).format(now);
  } catch {
    local = now.toISOString().slice(11, 16);
  }
  const minutes = (value: string) => {
    const [hour = "0", minute = "0"] = value.split(":");
    return Number(hour) * 60 + Number(minute);
  };
  const current = minutes(local);
  const start = minutes(row.quietStart || "21:00");
  const end = minutes(row.quietEnd || "08:00");
  return start <= end ? current >= start && current < end : current >= start || current < end;
}

export type SendDecision = { ok: true } | { ok: false; reason: string };

/**
 * Checked before every app-initiated or automated send.
 * Manual texts skip quiet hours. Review and marketing texts also need a consent row.
 */
export function decideSend(input: {
  kind: SendKind;
  optedOut: boolean;
  quiet: QuietHours | null;
  hasConsent: boolean;
  now?: Date;
}): SendDecision {
  if (input.optedOut) {
    return {
      ok: false,
      reason:
        "This person replied STOP. They have to text START before you can message them again.",
    };
  }

  const automated = input.kind !== "manual";
  if (automated && input.quiet && isQuietHours(input.quiet, input.now)) {
    return {
      ok: false,
      reason: "Quiet hours are on, so automated texts wait until the window ends.",
    };
  }

  if ((input.kind === "review" || input.kind === "marketing") && !input.hasConsent) {
    return {
      ok: false,
      reason: "Record consent for this number before sending a review or marketing text.",
    };
  }

  return { ok: true };
}

export function consentPurpose(kind: SendKind): "review" | "marketing" | null {
  if (kind === "review" || kind === "marketing") return kind;
  return null;
}
