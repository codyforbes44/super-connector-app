/**
 * ElevenLabs webhook HMAC and the shared secret used by receptionist tools.
 *
 * Post-call webhooks send `ElevenLabs-Signature: t=<unix>,v0=<hex>` where the
 * hex is HMAC-SHA256 of `${t}.${rawBody}`. Webhook tools do not sign that way;
 * they send the shared secret in `x-sixvox-tool-secret` (or `?t=`).
 */

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function signElevenLabs(
  secret: string,
  rawBody: string,
  timestamp: number,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${rawBody}`),
  );
  return bytesToHex(new Uint8Array(mac));
}

const MAX_AGE_SECONDS = 30 * 60;

async function hmacOk(
  secret: string,
  rawBody: string,
  header: string,
  nowMs: number,
): Promise<boolean> {
  let timestamp = "";
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [key, value] = part.trim().split("=", 2);
    if (key === "t" && value) timestamp = value;
    if (key === "v0" && value) signatures.push(value);
  }
  if (!timestamp || signatures.length === 0) return false;
  const age = Math.abs(nowMs / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > MAX_AGE_SECONDS) return false;
  const expected = await signElevenLabs(secret, rawBody, Number(timestamp));
  return signatures.some((signature) => timingSafeEqual(signature, expected));
}

export function elevenLabsSecrets(env: Record<string, string | undefined> = process.env): string[] {
  return [
    env["ELEVENLABS_WEBHOOK_SECRET"],
    env["ELEVENLABS_TOOL_SECRET"],
    env["TWILIO_WEBHOOK_TOKEN"],
  ].filter((value): value is string => Boolean(value));
}

export async function verifyElevenLabsRequest(
  request: Request,
  rawBody: string,
  nowMs = Date.now(),
): Promise<{ ok: true; via: "signature" | "secret" } | { ok: false; reason: string }> {
  const secrets = elevenLabsSecrets();
  if (!secrets.length) return { ok: false, reason: "no ElevenLabs webhook secret configured" };

  const signature = request.headers.get("elevenlabs-signature");
  if (signature) {
    for (const secret of secrets) {
      if (await hmacOk(secret, rawBody, signature, nowMs)) return { ok: true, via: "signature" };
    }
  }

  const provided =
    request.headers.get("x-sixvox-tool-secret") ?? new URL(request.url).searchParams.get("t") ?? "";
  if (provided && secrets.some((secret) => timingSafeEqual(secret, provided))) {
    return { ok: true, via: "secret" };
  }

  return {
    ok: false,
    reason: signature
      ? "ElevenLabs signature mismatch"
      : "missing ElevenLabs signature or shared secret",
  };
}
