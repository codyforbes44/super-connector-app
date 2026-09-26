import {
  canSendAutomatedText,
  reviewRequestBody,
  type AutomatedBlockReason,
  type AutomatedSendInput,
} from "./automated-text";

export type ReviewDecision =
  | { send: true; messagingServiceSid: string; body: string }
  | { send: false; reason: AutomatedBlockReason | "missing_review_url" };

export function decideReviewRequest(
  input: Omit<AutomatedSendInput, "enforceQuietHours"> & {
    reviewUrl?: string | null;
    businessName?: string | null;
  },
): ReviewDecision {
  const reviewUrl = input.reviewUrl?.trim() ?? "";
  if (!reviewUrl) return { send: false, reason: "missing_review_url" };
  let parsed: URL;
  try {
    parsed = new URL(reviewUrl);
  } catch {
    return { send: false, reason: "missing_review_url" };
  }
  if (parsed.protocol !== "https:") return { send: false, reason: "missing_review_url" };

  const decision = canSendAutomatedText({
    ...input,
    enforceQuietHours: true,
    kind: "review",
    hasConsent: input.hasConsent ?? true,
  });
  if (!decision.allow) return { send: false, reason: decision.reason };
  return {
    send: true,
    messagingServiceSid: decision.messagingServiceSid,
    body: reviewRequestBody({ businessName: input.businessName, reviewUrl }),
  };
}

export function consentActionFor(reason: ReviewDecision): "sent" | "opted_out" | "skipped" {
  if (reason.send) return "sent";
  if (!reason.send && reason.reason === "opted_out") return "opted_out";
  return "skipped";
}
