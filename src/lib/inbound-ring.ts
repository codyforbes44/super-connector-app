import { UNANSWERED_DIAL_STATUSES } from "./missed-call";
import type { InboundRingPlan } from "./ring-targets";

/** Twilio allows at most ten simultaneous `<Number>` or `<Client>` nouns. */
export const MAX_SIMULTANEOUS_CLIENTS = 10;

export type InboundAnswerChoice =
  { kind: "clients"; identities: string[] } | { kind: "owner_cell"; cell: string } | { kind: "ai" };

export type DialFollowUp = { kind: "end" } | { kind: "owner_cell"; cell: string } | { kind: "ai" };

/**
 * Business-hours inbound answer for one loaded ring plan.
 * Present in-app clients win, then the owner's cell, then AI or voicemail.
 */
export function chooseInboundAnswer(
  plan: Pick<InboundRingPlan, "identities" | "fallback" | "ownerCell">,
): InboundAnswerChoice {
  if (plan.identities.length > 0) {
    return { kind: "clients", identities: plan.identities.slice(0, MAX_SIMULTANEOUS_CLIENTS) };
  }
  if (plan.fallback === "owner_cell" && plan.ownerCell) {
    return { kind: "owner_cell", cell: plan.ownerCell };
  }
  return { kind: "ai" };
}

/**
 * What dial-action should do after a `<Dial>` finishes.
 * Answered calls, and dials that are not part of the ring chain, end.
 * An unanswered client leg tries the owner cell once, then AI or voicemail.
 */
export function continueInboundDial(input: {
  dialStatus: string;
  leg: string | null;
  ownerCell: string | null;
}): DialFollowUp {
  const status = input.dialStatus.trim().toLowerCase();
  if (!(UNANSWERED_DIAL_STATUSES as readonly string[]).includes(status)) {
    return { kind: "end" };
  }
  if (input.leg === "owner_cell") return { kind: "ai" };
  if (input.leg === "clients") {
    const cell = input.ownerCell?.trim() ?? "";
    if (cell) return { kind: "owner_cell", cell };
    return { kind: "ai" };
  }
  return { kind: "end" };
}
