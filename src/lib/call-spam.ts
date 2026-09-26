/**
 * How a call row should read on the Calls screen.
 * Spam-blocked rows must not look like an ordinary missed call.
 */

export type CallScreening = "all" | "spam" | "normal";

export type CallerListKind = "allow" | "block";

export type CallScreeningFields = {
  spam_action?: string | null;
  spam_score?: number | null;
  spam_reason?: string | null;
  status?: string | null;
  answer_path?: string | null;
  stir_verstat?: string | null;
  line_type?: string | null;
  direction?: string | null;
  answered_by?: string | null;
  from_number?: string | null;
  to_number?: string | null;
};

/** PostgREST `or` filter for rows the gate treated as spam. */
export const SPAM_BLOCKED_OR =
  "spam_action.in.(block,blocked),status.eq.blocked,answer_path.eq.spam";

/**
 * PostgREST `or` filters, ANDed together, for rows that are not spam-blocked.
 * Null screening fields count as a normal call.
 */
export const NOT_SPAM_ORS = [
  "spam_action.is.null,spam_action.not.in.(block,blocked)",
  "status.is.null,status.neq.blocked",
  "answer_path.is.null,answer_path.neq.spam",
] as const;

const BLOCK_LIST_REASON = "On the block list.";

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/** True when this row was stopped as spam, whatever column the gate wrote. */
export function isSpamBlocked(call: CallScreeningFields): boolean {
  const action = norm(call.spam_action);
  if (action === "block" || action === "blocked") return true;
  if (norm(call.status) === "blocked") return true;
  if (norm(call.answer_path) === "spam") return true;
  return false;
}

/** Plain-language description of what happened on a call. */
export function callStory(call: CallScreeningFields): string {
  if (isSpamBlocked(call)) {
    if ((call.spam_reason ?? "").trim() === BLOCK_LIST_REASON) {
      return "On your block list, so it never rang.";
    }
    return "Stopped before it rang. This looks like spam.";
  }
  const inbound = call.direction === "inbound";
  const failed = ["no-answer", "failed", "busy", "canceled"].includes(call.status ?? "");
  const byAi = /ai|receptionist|assistant|agent/i.test(call.answered_by ?? "");
  if (failed) return inbound ? "Missed call" : "No answer";
  if (byAi) return "Answered by receptionist";
  return inbound ? "Incoming call" : "Outgoing call";
}

export function matchesScreening(call: CallScreeningFields, screening: CallScreening): boolean {
  const blocked = isSpamBlocked(call);
  switch (screening) {
    case "all":
      return true;
    case "spam":
      return blocked;
    case "normal":
      return !blocked;
    default: {
      const unreachable: never = screening;
      return unreachable;
    }
  }
}

export function describeScreening(call: CallScreeningFields): string {
  if (isSpamBlocked(call)) return "Blocked before it rang";
  if (norm(call.spam_action) === "allow") return "Allowed through";
  return "Not screened";
}

export function describeSpamScore(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) return "Not scored";
  return `${Math.round(score)} out of 100`;
}

type StirKind = "none" | "full" | "partial" | "gateway" | "failed" | "other";

function stirKind(value: string | null | undefined): StirKind {
  const raw = (value ?? "").trim();
  if (!raw) return "none";
  const upper = raw.toUpperCase();
  if (upper.startsWith("TN-VALIDATION-FAILED") || upper === "FAILED") return "failed";
  if (upper.startsWith("A")) return "full";
  if (upper.startsWith("B")) return "partial";
  if (upper.startsWith("C")) return "gateway";
  return "other";
}

/** STIR/SHAKEN attestation in words a tradesperson can use. */
export function describeStir(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  const kind = stirKind(value);
  switch (kind) {
    case "none":
      return "No carrier attestation on this call";
    case "full":
      return `Full attestation (${raw}) — the carrier vouches for this caller`;
    case "partial":
      return `Partial attestation (${raw}) — the carrier knows the caller, not the whole path`;
    case "gateway":
      return `Gateway attestation (${raw}) — the carrier did not fully vouch for this caller`;
    case "failed":
      return `Failed check (${raw}) — the carrier could not verify this caller`;
    case "other":
      return raw;
    default: {
      const unreachable: never = kind;
      return unreachable;
    }
  }
}

/** Twilio Lookup line type, spelled out. */
export function describeLineType(value: string | null | undefined): string {
  const type = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, "");
  switch (type) {
    case "":
    case "unknown":
      return "Unknown line type";
    case "mobile":
      return "Mobile phone";
    case "landline":
      return "Landline";
    case "fixedvoip":
      return "Fixed VoIP";
    case "nonfixedvoip":
      return "Non-fixed VoIP — often used by robocallers";
    case "tollfree":
      return "Toll-free";
    case "premium":
      return "Premium-rate line";
    default:
      return (value ?? "").trim();
  }
}

export function spamFacts(call: CallScreeningFields): { label: string; value: string }[] {
  const facts: { label: string; value: string }[] = [];
  if (call.spam_action || call.spam_score != null || isSpamBlocked(call)) {
    facts.push({ label: "Screening", value: describeScreening(call) });
  }
  if (call.spam_score != null) {
    facts.push({ label: "Spam score", value: describeSpamScore(call.spam_score) });
  }
  const reason = (call.spam_reason ?? "").trim();
  if (reason) facts.push({ label: "Why", value: reason });
  if ((call.line_type ?? "").trim()) {
    facts.push({ label: "Line type", value: describeLineType(call.line_type) });
  }
  if ((call.stir_verstat ?? "").trim()) {
    facts.push({ label: "Carrier check", value: describeStir(call.stir_verstat) });
  }
  return facts;
}

/** The other party on a call row, or "" when the number is unusable. */
export function otherPartyNumber(call: CallScreeningFields): string {
  const raw = call.direction === "inbound" ? call.from_number : call.to_number;
  const value = (raw ?? "").trim();
  if (!value || /anonymous|unknown|restricted|private/i.test(value)) return "";
  return value.replace(/^client:/, "");
}

export function sameCallerNumber(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = (a ?? "").replace(/\D/g, "");
  const right = (b ?? "").replace(/\D/g, "");
  if (left.length < 7 || right.length < 7) return false;
  return left === right || left.endsWith(right) || right.endsWith(left);
}

export function callerListForNumber(
  rules: readonly { phone_number: string; list: string }[],
  phone: string,
): CallerListKind | null {
  let allow: CallerListKind | null = null;
  for (const rule of rules) {
    if (!sameCallerNumber(rule.phone_number, phone)) continue;
    if (rule.list === "block") return "block";
    if (rule.list === "allow") allow = "allow";
  }
  return allow;
}

export function hasCallFilters(filters: {
  q: string;
  direction: string;
  range: string;
  device: string;
  screening: CallScreening;
}): boolean {
  return (
    filters.q.trim() !== "" ||
    filters.direction !== "all" ||
    filters.range !== "all" ||
    filters.device !== "all" ||
    filters.screening !== "all"
  );
}
