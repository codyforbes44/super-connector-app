import { toast } from "sonner";

import { errorMessage } from "./format";

/** Plan-limit errors from the server always say what the plan includes and how to get more. */
export function isPlanLimitMessage(message: string): boolean {
  return /plan includes|isn't included on this plan|upgrade (to|for)/i.test(message);
}

/** Show an error; plan limits get a "See plans" button that opens Billing. */
export function toastError(error: unknown): void {
  const message = errorMessage(error);
  if (isPlanLimitMessage(message)) {
    toast.error("Plan limit reached", {
      description: message,
      duration: 12_000,
      action: { label: "See plans", onClick: () => window.location.assign("/billing") },
    });
    return;
  }
  toast.error(message);
}
