/**
 * Inbound ring plan for the native-app PSTN fallback.
 *
 * Flag off (the default): the webhook keeps today's client-only ring.
 * Flag on: ring registered clients for ~8s. If none of them acknowledge the
 * invite, keep ringing the clients and also dial the owner's cell for the
 * rest of the ring window. Voicemail / AI still runs after that window.
 */

export const MOBILE_PSTN_FALLBACK_ENV = "MOBILE_PSTN_FALLBACK";
export const ACK_WINDOW_SECONDS = 8;
export const ACK_STAGE = "ack-check";

const ENABLED = new Set(["1", "true", "on", "yes"]);

export function pstnFallbackEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const raw = (env[MOBILE_PSTN_FALLBACK_ENV] ?? "").trim().toLowerCase();
  return ENABLED.has(raw);
}

export type PstnRingPlan =
  | { action: "skip" }
  | { action: "clients"; timeout: number; nextStage: string }
  | { action: "clients-and-cell"; timeout: number; nextStage: string; cell: string };

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

export function planPstnFallback(input: {
  enabled: boolean;
  stage: string | null;
  ringSeconds: number;
  /** true = a device showed the call, false = nobody did, null = lookup failed. */
  acked: boolean | null;
  ownerCell: string | null;
  caller: string | null;
}): PstnRingPlan {
  if (!input.enabled) return { action: "skip" };

  if (!input.stage) {
    return {
      action: "clients",
      timeout: Math.min(ACK_WINDOW_SECONDS, input.ringSeconds),
      nextStage: ACK_STAGE,
    };
  }

  if (input.stage !== ACK_STAGE) return { action: "skip" };

  const remaining = Math.max(1, input.ringSeconds - ACK_WINDOW_SECONDS);
  const cellDigits = digits(input.ownerCell ?? "");
  const callerDigits = digits(input.caller ?? "");
  const cell = (input.ownerCell ?? "").trim();
  // Unknown ack means we do not guess and start ringing a personal cell.
  const ringCell = input.acked === false && cellDigits.length >= 10 && cellDigits !== callerDigits;

  if (ringCell) {
    return {
      action: "clients-and-cell",
      timeout: remaining,
      nextStage: "retry-done",
      cell,
    };
  }

  return { action: "clients", timeout: remaining, nextStage: "retry-done" };
}
