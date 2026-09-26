const APPROVED = new Set(["VERIFIED", "APPROVED", "REGISTERED"]);

export type OutboundSmsDecision = {
  allowed: boolean;
  reason: string | null;
};

/**
 * US business texts stay blocked until the workspace campaign is approved.
 * The original SixVox workspace is grandfathered because it already texts.
 * A client-supplied Messaging Service SID must not bypass this.
 */
export function outboundSmsDecision(input: {
  channel: "sms" | "whatsapp";
  grandfathered: boolean;
  campaignStatus: string | null;
}): OutboundSmsDecision {
  if (input.channel === "whatsapp") return { allowed: true, reason: null };
  if (input.grandfathered) return { allowed: true, reason: null };
  const status = (input.campaignStatus ?? "").toUpperCase();
  if (APPROVED.has(status)) return { allowed: true, reason: null };
  const label = input.campaignStatus?.trim() || "not registered";
  return {
    allowed: false,
    reason: `Texting is paused until US carrier registration is approved (status: ${label}).`,
  };
}
