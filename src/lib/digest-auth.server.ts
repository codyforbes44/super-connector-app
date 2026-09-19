import { timingSafeEqual } from "node:crypto";

/** A scheduler-only secret, never a Supabase publishable/anon key. */
export function isDigestRequestAuthorized(
  request: Request,
  secret = process.env["DIGEST_CRON_SECRET"],
): boolean {
  if (!secret || !/^[A-Za-z0-9_-]{43,128}$/.test(secret)) return false;
  const match = /^Bearer ([A-Za-z0-9_-]+)$/i.exec(
    request.headers.get("authorization") ?? "",
  );
  if (!match?.[1]) return false;
  const expected = Buffer.from(secret, "utf8");
  const supplied = Buffer.from(match[1], "utf8");
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
}
