/**
 * Twilio request-signature validation (X-Twilio-Signature).
 *
 * Twilio signs `full URL + concat(sorted(key + value))` with the account Auth
 * Token using HMAC-SHA1, base64 encoded. Behind Cloudflare / Lovable the
 * runtime request URL is often an internal origin, while Twilio signed the
 * public webhook: https://sixvox.3bi.io plus the path and query string, with
 * POST form fields appended after that URL.
 *
 * A valid signature is required. When TWILIO_WEBHOOK_TOKEN is set, the `?t=`
 * query value must also match — it never authorizes a request whose signature
 * is missing or wrong.
 */

import { PUBLIC_BASE_URL } from "./app.server";

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

function firstHeaderValue(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim() ?? "";
  return first || null;
}

function stripDefaultPort(host: string): string {
  return host.replace(/:(443|80)$/, "");
}

/** URLs Twilio may have signed for this request. The public base URL is first. */
function twilioSignedUrlCandidates(request: Request): string[] {
  const url = new URL(request.url);
  const pathAndQuery = `${url.pathname}${url.search}`;
  const urls = new Set<string>();

  urls.add(`${PUBLIC_BASE_URL}${pathAndQuery}`);

  const received = new URL(url.toString());
  if (received.port === "443" || received.port === "80") received.port = "";
  urls.add(received.toString());

  const forwardedHost = stripDefaultPort(
    firstHeaderValue(request.headers.get("x-forwarded-host") ?? request.headers.get("host")) ?? "",
  );
  const forwardedProto = firstHeaderValue(request.headers.get("x-forwarded-proto")) ?? "https";
  if (forwardedHost) {
    urls.add(`${forwardedProto}://${forwardedHost}${pathAndQuery}`);
    urls.add(`https://${forwardedHost}${pathAndQuery}`);
  }

  return [...urls];
}

function signedPayload(url: string, params: Record<string, string>): string {
  const sorted = Object.keys(params).sort();
  const joined = sorted.map((key) => `${key}${params[key] ?? ""}`).join("");
  return `${url}${joined}`;
}

export type WebhookAuth = {
  params: Record<string, string>;
} & ({ ok: true; via: "signature" } | { ok: false; reason: string });

/**
 * Verifies an inbound Twilio webhook and returns its form params.
 * Fails closed: a shared `?t=` token cannot replace the signature.
 */
export async function verifyTwilioWebhook(request: Request): Promise<WebhookAuth> {
  const body = await request.text();
  const params: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(body)) params[key] = value;

  const authToken = process.env["TWILIO_AUTH_TOKEN"];
  const signature = request.headers.get("x-twilio-signature")?.trim() ?? "";

  if (!authToken) return { ok: false, reason: "missing Twilio auth token", params };
  if (!signature) return { ok: false, reason: "missing signature", params };

  let matched = false;
  for (const url of twilioSignedUrlCandidates(request)) {
    const expected = await sign(authToken, signedPayload(url, params));
    if (timingSafeEqual(expected, signature)) {
      matched = true;
      break;
    }
  }
  if (!matched) return { ok: false, reason: "signature mismatch", params };

  const expectedToken = process.env["TWILIO_WEBHOOK_TOKEN"] ?? "";
  if (expectedToken) {
    const providedToken = new URL(request.url).searchParams.get("t") ?? "";
    if (!providedToken || !timingSafeEqual(expectedToken, providedToken)) {
      return { ok: false, reason: "shared token mismatch", params };
    }
  }

  return { ok: true, params, via: "signature" };
}

function loggableUrl(request: Request): string {
  const url = new URL(request.url);
  const logged = new URL(`${url.pathname}${url.search}`, PUBLIC_BASE_URL);
  logged.searchParams.delete("t");
  return logged.toString();
}

export async function rejectWebhook(
  request: Request,
  reason: string,
  params: Record<string, string> = {},
): Promise<Response> {
  const url = new URL(request.url);
  console.warn(`Rejected Twilio webhook at ${url.pathname}: ${reason}`);
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logWebhookError } = await import("@/lib/webhook-errors.server");
    const to = params["To"] ?? "";
    await logWebhookError(supabaseAdmin, {
      source: url.pathname.split("/").filter(Boolean).pop() || "twilio",
      message: `Rejected Twilio webhook: ${reason}`,
      url: loggableUrl(request),
      callSid: params["CallSid"] ?? null,
      appNumber: to ? to.replace(/^whatsapp:/, "") : null,
      payload: { reason },
    });
  } catch (error) {
    console.error("Failed to log rejected Twilio webhook", error);
  }
  return new Response("Unauthorized", { status: 401 });
}
