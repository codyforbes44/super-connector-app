/** Spoken notice. Played before a recording starts, on every recorded leg. */
export const RECORDING_CONSENT = "This call may be recorded and transcribed for note taking.";

/** The AI identifies itself on every answered AI call. */
export const AI_IDENTITY = "This is an automated assistant.";

/**
 * Stored as the assistant's first message and spoken before the AI hand-off.
 * All-party baseline: mention recording only when this line records calls.
 */
export function composeAiFirstMessage(custom: string | null | undefined, record: boolean): string {
  const base = (custom ?? "")
    .replace(RECORDING_CONSENT, "")
    .replace(AI_IDENTITY, "")
    .replace(/\s+/g, " ")
    .trim();
  const identity = base ? `${AI_IDENTITY} ${base}` : AI_IDENTITY;
  if (!record) return identity;
  return `${identity} ${RECORDING_CONSENT}`;
}
