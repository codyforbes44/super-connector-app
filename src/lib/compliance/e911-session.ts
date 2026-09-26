import { E911_DISCLOSURE_VERSION } from "@/lib/compliance/disclosure";

/**
 * In-memory dismissals of the 911 notice, keyed by user and disclosure version.
 *
 * A full page load creates a new JavaScript realm, so the notice comes back
 * until the user acknowledges it. Client-side route changes keep this module
 * loaded, so one dismiss stays closed for the rest of that visit. Sign-out
 * clears it, and the next sign-in shows the notice again. This is not an
 * acknowledgment and is never written to e911_acknowledgments.
 */
const dismissed = new Set<string>();
const listeners = new Set<() => void>();

function dismissKey(userId: string): string {
  return `${userId}:${E911_DISCLOSURE_VERSION}`;
}

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeE911NoticeDismissals(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isE911NoticeDismissed(userId: string): boolean {
  return dismissed.has(dismissKey(userId));
}

export function dismissE911Notice(userId: string): void {
  const key = dismissKey(userId);
  if (dismissed.has(key)) return;
  dismissed.add(key);
  emit();
}

export function clearE911NoticeDismissals(): void {
  if (dismissed.size === 0) return;
  dismissed.clear();
  emit();
}

/** Drop the reminder when the session ends so the next sign-in shows it. */
export function handleE911AuthEvent(event: string): void {
  if (event === "SIGNED_OUT") clearE911NoticeDismissals();
}
