/**
 * Abuse gate for the public concierge token endpoint.
 *
 * Minting an ElevenLabs conversation token costs money, so an unauthenticated
 * POST must not be unbounded. Counters live in a per-isolate in-memory Map with
 * a rolling TTL window. LIMITATION: serverless isolates are not shared, so the
 * effective ceiling is per-isolate rather than global. That is deliberate for
 * this tip — it bounds a burst from one client without adding infrastructure.
 * Swap `hit()` for Redis/Upstash if a hard global cap is ever required.
 */

const WINDOW_MS = 60 * 60 * 1000;
export const ANON_LIMIT = 30;
export const SIGNED_IN_LIMIT = 120;

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}

/** Increments the counter for `key`; false when the caller is over `limit`. */
export function hit(key: string, limit: number): boolean {
  const now = Date.now();
  sweep(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

/** Best-effort client IP from the edge proxy headers. */
export function clientIp(request: Request): string {
  const header =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for") ??
    "";
  return header.split(",")[0]?.trim() || "unknown";
}

const ALLOWED_HOSTS = ["sixvox.3bi.io", "lovable.app", "lovableproject.com", "localhost"];

/**
 * Soft bot gate: block requests that clearly come from another site. Requests
 * with no Origin/Referer at all (native clients, some privacy modes) pass.
 */
export function originAllowed(request: Request): boolean {
  const raw = request.headers.get("origin") ?? request.headers.get("referer");
  if (!raw) return true;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return true;
  }
}
