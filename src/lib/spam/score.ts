/**
 * Spam gate. Allow-list always rings. Block-list and a high score never ring
 * and must not be handed to the AI receptionist.
 */

export type SpamSignals = {
  stirVerstat?: string | null;
  /** Twilio Lookup line type: mobile, landline, fixedVoip, nonFixedVoip, tollFree, premium, … */
  lineType?: string | null;
  allowListed: boolean;
  blockListed: boolean;
};

export type SpamDecision = {
  score: number;
  action: "allow" | "block";
  reason: string;
  /** False means do not ring the owner and do not start the AI. */
  ring: boolean;
};

const BLOCK_AT = 70;

function stirScore(value: string | null | undefined): { points: number; note: string } {
  const raw = (value ?? "").trim();
  if (!raw) return { points: 15, note: "no SHAKEN attestation" };
  const upper = raw.toUpperCase();
  if (upper.startsWith("TN-VALIDATION-FAILED") || upper === "FAILED") {
    return { points: 70, note: `StirVerstat ${raw}` };
  }
  if (upper.startsWith("C")) return { points: 25, note: `StirVerstat ${raw}` };
  if (upper.startsWith("B")) return { points: 10, note: `StirVerstat ${raw}` };
  if (upper.startsWith("A")) return { points: 0, note: `StirVerstat ${raw}` };
  return { points: 20, note: `StirVerstat ${raw}` };
}

function lineScore(value: string | null | undefined): { points: number; note: string } {
  const type = (value ?? "").trim().toLowerCase();
  if (!type || type === "unknown") return { points: 10, note: "unknown line type" };
  if (type === "nonfixedvoip" || type === "non_fixed_voip")
    return { points: 40, note: "non-fixed VoIP" };
  if (type === "premium") return { points: 50, note: "premium line" };
  if (type === "tollfree" || type === "toll_free") return { points: 20, note: "toll-free line" };
  if (type === "fixedvoip" || type === "fixed_voip") return { points: 15, note: "fixed VoIP" };
  if (type === "mobile" || type === "landline") return { points: 0, note: type };
  return { points: 10, note: type };
}

export function scoreSpam(signals: SpamSignals, threshold = BLOCK_AT): SpamDecision {
  if (signals.allowListed) {
    return { score: 0, action: "allow", reason: "On the allow list.", ring: true };
  }
  if (signals.blockListed) {
    return { score: 100, action: "block", reason: "On the block list.", ring: false };
  }

  const stir = stirScore(signals.stirVerstat);
  const line = lineScore(signals.lineType);
  const score = Math.min(100, stir.points + line.points);
  if (score >= threshold) {
    return {
      score,
      action: "block",
      reason: `Known spam (${stir.note}, ${line.note}).`,
      ring: false,
    };
  }
  return {
    score,
    action: "allow",
    reason: `Looks legitimate (${stir.note}, ${line.note}).`,
    ring: true,
  };
}
