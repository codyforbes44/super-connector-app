/**
 * Twilio Voice Access Tokens (server-only).
 *
 * A Voice SDK token is a JWT signed with a Twilio API Key secret — the account
 * Auth Token cannot sign one. The key pair lives in TWILIO_API_KEY_SID /
 * TWILIO_API_KEY_SECRET.
 */

function b64url(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i] as number);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function voiceIdentityFor(userId: string): string {
  return `agent_${userId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

export function userIdFromVoiceIdentity(identity: string): string | null {
  const cleaned = identity.replace(/^client:/, "");
  return cleaned.startsWith("agent_") ? cleaned.slice("agent_".length) : null;
}

export type VoiceTokenResult = {
  token: string;
  identity: string;
  expiresAt: string;
  applicationSid: string;
};

export async function mintVoiceToken(opts: {
  userId: string;
  applicationSid: string;
  ttlSeconds?: number;
  /** Twilio Push Credential SID (CRxxxx). Omitted for browser tokens. */
  pushCredentialSid?: string;
}): Promise<VoiceTokenResult> {
  const accountSid = process.env["TWILIO_ACCOUNT_SID"];
  const keySid = process.env["TWILIO_API_KEY_SID"];
  const keySecret = process.env["TWILIO_API_KEY_SECRET"];
  if (!accountSid || !keySid || !keySecret) {
    throw new Error(
      "In-app calling needs a Twilio API Key. Ask an admin to finish the voice setup in Settings.",
    );
  }

  const identity = voiceIdentityFor(opts.userId);
  const ttl = opts.ttlSeconds ?? 3600;
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttl;

  const header = { alg: "HS256", typ: "JWT", cty: "twilio-fpa;v=1" };
  const payload = {
    jti: `${keySid}-${now}`,
    iss: keySid,
    sub: accountSid,
    nbf: now - 10,
    exp,
    grants: {
      identity,
      voice: {
        incoming: { allow: true },
        outgoing: { application_sid: opts.applicationSid },
        ...(opts.pushCredentialSid ? { push_credential_sid: opts.pushCredentialSid } : {}),
      },
    },
  };

  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(keySecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));

  return {
    token: `${signingInput}.${b64url(new Uint8Array(mac))}`,
    identity,
    expiresAt: new Date(exp * 1000).toISOString(),
    applicationSid: opts.applicationSid,
  };
}
