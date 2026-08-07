/**
 * Twilio request-signature validation (X-Twilio-Signature).
 *
 * Twilio signs `URL + concat(sorted(key + value))` with the account Auth Token
 * using HMAC-SHA1, base64 encoded. Web Crypto covers this in the Worker runtime.
 */

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sign(authToken: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(mac)));
}

/** The URLs Twilio may have signed — proxies can rewrite scheme/host. */
function candidateUrls(request: Request): string[] {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const urls = new Set<string>([url.toString()]);
  if (forwardedHost) {
    urls.add(`${forwardedProto}://${forwardedHost}${url.pathname}${url.search}`);
    urls.add(`https://${forwardedHost}${url.pathname}${url.search}`);
  }
  return [...urls];
}

export type WebhookAuth =
  | { ok: true; params: Record<string, string>; via: "signature" | "token" }
  | { ok: false; reason: string };

/**
 * Verifies an inbound Twilio webhook and returns its form params.
 *
 * Prefers the cryptographic signature; falls back to the shared `?t=` token so
 * numbers wired before signature validation keep working.
 */
export async function verifyTwilioWebhook(request: Request): Promise<WebhookAuth> {
  const body = await request.text();
  const params: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(body)) params[key] = value;

  const authToken = process.env["TWILIO_AUTH_TOKEN"];
  const signature = request.headers.get("x-twilio-signature");

  if (authToken && signature) {
    const sorted = Object.keys(params).sort();
    const joined = sorted.map((key) => `${key}${params[key]}`).join("");
    for (const url of candidateUrls(request)) {
      const expected = await sign(authToken, `${url}${joined}`);
      if (timingSafeEqual(expected, signature)) return { ok: true, params, via: "signature" };
    }
  }

  const expectedToken = process.env["TWILIO_WEBHOOK_TOKEN"];
  const providedToken = new URL(request.url).searchParams.get("t");
  if (expectedToken && providedToken && timingSafeEqual(expectedToken, providedToken)) {
    return { ok: true, params, via: "token" };
  }

  return {
    ok: false,
    reason: signature ? "signature mismatch" : "missing signature and shared token",
  };
}

export function rejectWebhook(request: Request, reason: string): Response {
  console.warn(`Rejected Twilio webhook at ${new URL(request.url).pathname}: ${reason}`);
  return new Response("Unauthorized", { status: 401 });
}