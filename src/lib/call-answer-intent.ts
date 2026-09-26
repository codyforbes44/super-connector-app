/**
 * Short-lived "the user tapped Answer" flag, set from an incoming-call
 * notification and consumed by the in-call screen when Twilio delivers the
 * ringing call a moment later.
 */
let expiresAt = 0;

export function markAnswerIntent(ttlMs = 30_000): void {
  expiresAt = Date.now() + ttlMs;
}

export function consumeAnswerIntent(): boolean {
  const pending = Date.now() < expiresAt;
  expiresAt = 0;
  return pending;
}

export function clearAnswerIntent(): void {
  expiresAt = 0;
}
