/** One-line summary when a call has no transcript yet. No model call. */

export function factualCallSummary(input: {
  direction: string;
  status: string | null;
  answeredInApp: boolean;
  answerPath: string | null;
  durationSeconds: number | null;
  from: string;
  hasRecording: boolean;
  spamBlocked: boolean;
}): string | null {
  if (input.spamBlocked) return null;
  const who = input.from || "Unknown caller";
  const minutes = input.durationSeconds
    ? `${Math.max(1, Math.round(input.durationSeconds / 60))} min`
    : null;
  if (input.answeredInApp) {
    return `In-app call with ${who}${minutes ? ` (${minutes})` : ""}.`;
  }
  if (input.answerPath === "ai_agent") {
    return `AI receptionist answered ${who}${minutes ? ` (${minutes})` : ""}.`;
  }
  if (input.hasRecording) {
    return `Voicemail from ${who}.`;
  }
  const status = (input.status ?? "").toLowerCase();
  if (["no-answer", "busy", "failed", "canceled"].includes(status)) {
    return `Missed call from ${who}.`;
  }
  if (status === "completed") {
    return `Call with ${who}${minutes ? ` (${minutes})` : ""}.`;
  }
  return null;
}
