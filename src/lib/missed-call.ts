/**
 * Missed-call detection for inbound Twilio calls.
 *
 * A parent inbound call is already "answered" by Twilio once TwiML runs, so
 * CallStatus `completed` does not mean a person picked up. The dial leg reports
 * DialCallStatus on the Dial action URL: completed, answered, busy, no-answer,
 * failed, or canceled. https://www.twilio.com/docs/voice/twiml/dial
 */

import {
  detectCallerLanguage,
  parseLineLanguage,
  transcriptUtterance,
  type LineLanguage,
} from "@/lib/answering/language";

export const UNANSWERED_DIAL_STATUSES = ["no-answer", "busy", "failed", "canceled"] as const;
export const ANSWERED_DIAL_STATUSES = ["completed", "answered"] as const;
export const UNANSWERED_CALL_STATUSES = ["no-answer", "busy", "failed", "canceled"] as const;

export const DEFAULT_TEXT_BACK_TEMPLATE =
  "Sorry we missed your call. Text us back on this number and we'll help as soon as we can.";

export const DEFAULT_TEXT_BACK_TEMPLATE_ES =
  "Disculpe, no pudimos contestar su llamada. Responda a este número y le ayudamos en cuanto podamos.";

export const DEFAULT_TEXT_BACK_DEDUPE_MINUTES = 60;

export type HandledBy = "human" | "ai" | "voicemail" | "none";

export type MissedCallFacts = {
  direction: string;
  callStatus: string;
  dialStatus: string | null;
  answerPath: string | null;
  durationSeconds: number | null;
  hasAiConversation: boolean;
  hasVoicemailRecording: boolean;
  ringSeconds: number;
  textBackOnAi: boolean;
  textBackOnVoicemail: boolean;
};

export type TextBackReason =
  | "unanswered_dial"
  | "unanswered_call"
  | "abandoned_during_ring"
  | "opt_in_ai"
  | "opt_in_voicemail";

export type TextBackSkip =
  | "disabled"
  | "outbound"
  | "answered"
  | "ai_handled"
  | "voicemail_handled"
  | "in_progress"
  | "not_missed";

export type TextBackDecision =
  { send: true; reason: TextBackReason } | { send: false; reason: TextBackSkip };

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function classifyHandledBy(input: MissedCallFacts): HandledBy {
  const dial = norm(input.dialStatus);
  if ((ANSWERED_DIAL_STATUSES as readonly string[]).includes(dial)) return "human";
  if (input.hasAiConversation) return "ai";
  const duration = input.durationSeconds ?? 0;
  const reached = duration > input.ringSeconds;
  if (input.answerPath === "ai_agent" && reached) return "ai";
  if (
    input.hasVoicemailRecording &&
    input.answerPath !== "ai_agent" &&
    (input.answerPath === "voicemail" ||
      input.answerPath === "classic" ||
      input.answerPath === "ai_greeting" ||
      input.answerPath === null)
  ) {
    return "voicemail";
  }
  if (
    (input.answerPath === "voicemail" ||
      input.answerPath === "classic" ||
      input.answerPath === "ai_greeting") &&
    reached
  ) {
    return "voicemail";
  }
  return "none";
}

function terminal(callStatus: string, dialStatus: string): boolean {
  return (
    ["completed", ...UNANSWERED_CALL_STATUSES].includes(callStatus) ||
    (UNANSWERED_DIAL_STATUSES as readonly string[]).includes(dialStatus) ||
    (ANSWERED_DIAL_STATUSES as readonly string[]).includes(dialStatus)
  );
}

/**
 * True when nobody (human, AI, or voicemail) handled the inbound call.
 * Opt-in texts after an AI or voicemail conversation are not "missed" events.
 */
export function isUnansweredCall(input: MissedCallFacts): boolean {
  if (norm(input.direction) === "outbound") return false;
  const dial = norm(input.dialStatus);
  const status = norm(input.callStatus);
  if ((ANSWERED_DIAL_STATUSES as readonly string[]).includes(dial)) return false;
  const handled = classifyHandledBy(input);
  if (handled !== "none") return false;
  if ((UNANSWERED_DIAL_STATUSES as readonly string[]).includes(dial)) return true;
  if ((UNANSWERED_CALL_STATUSES as readonly string[]).includes(status)) return true;
  if (
    status === "completed" &&
    input.answerPath &&
    (input.durationSeconds ?? 0) <= input.ringSeconds
  ) {
    return true;
  }
  return false;
}

export function missedCallTextDecision(
  input: MissedCallFacts & { enabled: boolean },
): TextBackDecision {
  if (!input.enabled) return { send: false, reason: "disabled" };
  if (norm(input.direction) === "outbound") return { send: false, reason: "outbound" };

  const dial = norm(input.dialStatus);
  const status = norm(input.callStatus);
  const handled = classifyHandledBy(input);
  const done = terminal(status, dial);

  if (handled === "human" || (ANSWERED_DIAL_STATUSES as readonly string[]).includes(dial)) {
    return { send: false, reason: "answered" };
  }
  if (handled === "ai") {
    return input.textBackOnAi && done
      ? { send: true, reason: "opt_in_ai" }
      : { send: false, reason: "ai_handled" };
  }
  if (handled === "voicemail") {
    return input.textBackOnVoicemail && done
      ? { send: true, reason: "opt_in_voicemail" }
      : { send: false, reason: "voicemail_handled" };
  }
  if ((UNANSWERED_DIAL_STATUSES as readonly string[]).includes(dial)) {
    return { send: true, reason: "unanswered_dial" };
  }
  if ((UNANSWERED_CALL_STATUSES as readonly string[]).includes(status)) {
    return { send: true, reason: "unanswered_call" };
  }
  if (
    status === "completed" &&
    input.answerPath &&
    (input.durationSeconds ?? 0) <= input.ringSeconds
  ) {
    return { send: true, reason: "abandoned_during_ring" };
  }
  if (["", "queued", "ringing", "in-progress", "initiated"].includes(status)) {
    return { send: false, reason: "in_progress" };
  }
  return { send: false, reason: "not_missed" };
}

export function isDefaultTextBackTemplate(template: string | null | undefined): boolean {
  const trimmed = (template ?? "").trim();
  return (
    !trimmed || trimmed === DEFAULT_TEXT_BACK_TEMPLATE || trimmed === DEFAULT_TEXT_BACK_TEMPLATE_ES
  );
}

/**
 * Spanish default when the line is Spanish, or auto and this conversation is already Spanish.
 * A template the owner wrote is returned unchanged.
 */
export function resolveTextBackTemplate(args: {
  stored: string | null | undefined;
  lineLanguage: LineLanguage;
  callerSpokeSpanish: boolean;
}): string {
  const stored = (args.stored ?? "").trim();
  if (stored && !isDefaultTextBackTemplate(stored)) return stored;
  const spanish = missedCallDefaultsToSpanish(args.lineLanguage, args.callerSpokeSpanish);
  return spanish ? DEFAULT_TEXT_BACK_TEMPLATE_ES : DEFAULT_TEXT_BACK_TEMPLATE;
}

function missedCallDefaultsToSpanish(language: LineLanguage, callerSpokeSpanish: boolean): boolean {
  switch (language) {
    case "es":
      return true;
    case "auto":
      return callerSpokeSpanish;
    case "en":
      return false;
    default: {
      const _never: never = language;
      return _never;
    }
  }
}

/** Template chosen for this call. Does not write the stored template. */
export function missedCallTemplateForLine(args: {
  stored: string | null | undefined;
  lineLanguage: string | null | undefined;
  transcript?: unknown;
  summary?: string | null;
}): string {
  const lineLanguage = parseLineLanguage(args.lineLanguage);
  const callerSpokeSpanish =
    lineLanguage === "auto" &&
    detectCallerLanguage(transcriptUtterance(args.transcript, args.summary)) === "es";
  return resolveTextBackTemplate({
    stored: args.stored,
    lineLanguage,
    callerSpokeSpanish,
  });
}

/** Body actually texted. Does not write the stored template. */
export function missedCallTextBody(args: {
  stored: string | null | undefined;
  lineLanguage: string | null | undefined;
  transcript?: unknown;
  summary?: string | null;
  lineLabel: string;
  caller: string;
}): string {
  return renderTextBackTemplate(missedCallTemplateForLine(args), {
    line: args.lineLabel,
    caller: args.caller,
  });
}

/** Swap the editor text when the owner changes language and has not customized it. */
export function textBackDraftForLanguage(current: string, language: LineLanguage): string {
  if (!isDefaultTextBackTemplate(current)) return current;
  return resolveTextBackTemplate({
    stored: current,
    lineLanguage: language,
    callerSpokeSpanish: false,
  });
}

export function renderTextBackTemplate(
  template: string,
  vars: { line: string; caller: string },
): string {
  const source = template.trim() || DEFAULT_TEXT_BACK_TEMPLATE;
  return source
    .replaceAll("{{line}}", vars.line)
    .replaceAll("{{caller}}", vars.caller)
    .slice(0, 640);
}

/** True when this caller was already texted inside the dedupe window. */
export function isDuplicateTextBack(
  previousSentAt: Date | null,
  now: Date,
  windowMinutes: number,
): boolean {
  if (!previousSentAt) return false;
  if (windowMinutes <= 0) return false;
  return now.getTime() - previousSentAt.getTime() < windowMinutes * 60_000;
}
