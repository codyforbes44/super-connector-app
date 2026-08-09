/**
 * Server-only Twilio access layer.
 *
 * Two transports:
 *  - "api"  -> api.twilio.com/2010-04-01/Accounts/{Sid}/...  Uses the account's
 *              own credentials when saved (full access), otherwise falls back
 *              to the Lovable connector gateway, whose connection key is
 *              scoped to a subset of resources.
 *  - other  -> verify / lookups / messaging / pricing etc. subdomains, called
 *              directly with the account's own credentials when they exist.
 */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

export type TwilioHost =
  | "api"
  | "api-direct"
  | "verify"
  | "lookups"
  | "messaging"
  | "pricing"
  | "studio"
  | "conversations"
  | "insights"
  | "voice"
  | "trusthub"
  | "numbers"
  | "events"
  | "sync"
  | "taskrouter";

export class TwilioError extends Error {
  status: number;
  body: string;
  /** True when the account credentials themselves were rejected. */
  authFailure: boolean;
  constructor(status: number, body: string) {
    const authFailure = isAuthFailure(status, body);
    super(authFailure ? TWILIO_AUTH_MESSAGE : `Twilio request failed [${status}]: ${body}`);
    this.status = status;
    this.body = body;
    this.authFailure = authFailure;
  }
}

/** Shown to users whenever the carrier rejects our credentials (error 20003). */
export const TWILIO_AUTH_MESSAGE =
  "Your phone service credentials were rejected. Reconnect Twilio in Settings.";

function isAuthFailure(status: number, body: string): boolean {
  if (status === 401) return true;
  return /"code"\s*:\s*(20003|20005|20008)/.test(body);
}

export function hasDirectCredentials(): boolean {
  return Boolean(process.env["TWILIO_ACCOUNT_SID"] && process.env["TWILIO_AUTH_TOKEN"]);
}

export type TransportHealth = "ok" | "rejected" | "missing" | "error";

export type CredentialHealth = {
  gateway: TransportHealth;
  direct: TransportHealth;
  healthy: boolean;
  message: string | null;
};

async function probe(run: () => Promise<unknown>): Promise<TransportHealth> {
  try {
    await run();
    return "ok";
  } catch (error) {
    if (error instanceof TwilioError) {
      if (error.authFailure) return "rejected";
      if (error.status === 428 || error.status === 500) return "missing";
    }
    return "error";
  }
}

/** Live check that the stored carrier credentials still authenticate. */
export async function credentialHealth(): Promise<CredentialHealth> {
  const sid = process.env["TWILIO_ACCOUNT_SID"];
  const [gateway, direct] = await Promise.all([
    probe(() => twilioRequest({ path: "/Balance.json" })),
    hasDirectCredentials()
      ? probe(() => twilioRequest({ host: "api-direct", path: `/2010-04-01/Accounts/${sid}.json` }))
      : Promise.resolve<TransportHealth>("missing"),
  ]);
  const rejected = direct === "rejected" || (direct === "missing" && gateway === "rejected");
  const primary = hasDirectCredentials() ? direct : gateway;
  return {
    gateway,
    direct,
    healthy: primary === "ok",
    message: rejected
      ? TWILIO_AUTH_MESSAGE
      : primary === "missing"
        ? "Phone service is not connected for this workspace yet."
        : primary === "error"
          ? "Could not reach the phone service just now."
          : null,
  };
}

function encodeForm(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, String(item));
    } else {
      search.append(key, String(value));
    }
  }
  return search.toString();
}

/** Low-level call. `path` must start with "/". */
export async function twilioRequest<T = unknown>(opts: {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  params?: Record<string, unknown>;
  host?: TwilioHost;
}): Promise<T> {
  const method = opts.method ?? "GET";
  const host = opts.host ?? "api";
  const params = opts.params ?? {};

  let url: string;
  const headers: Record<string, string> = {};

  if (host === "api" && hasDirectCredentials()) {
    // Full account credentials reach every 2010-04-01 resource; the gateway's
    // connection key is scoped to a subset (messages/recordings/balance).
    const sid = process.env["TWILIO_ACCOUNT_SID"];
    const token = process.env["TWILIO_AUTH_TOKEN"];
    url = `https://api.twilio.com/2010-04-01/Accounts/${sid}${opts.path}`;
    headers["Authorization"] = `Basic ${btoa(`${sid}:${token}`)}`;
  } else if (host === "api") {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const connectionKey = process.env["TWILIO_API_KEY"];
    if (!lovableKey || !connectionKey) {
      throw new TwilioError(500, "Twilio connection is not configured for this project.");
    }
    url = `${GATEWAY_URL}${opts.path}`;
    headers["Authorization"] = `Bearer ${lovableKey}`;
    headers["X-Connection-Api-Key"] = connectionKey;
  } else {
    const sid = process.env["TWILIO_ACCOUNT_SID"];
    const token = process.env["TWILIO_AUTH_TOKEN"];
    if (!sid || !token) {
      throw new TwilioError(
        428,
        `This feature calls the ${host === "api-direct" ? "api" : host}.twilio.com API directly, which needs your Twilio Account SID and Auth Token saved in the app. Add them in Settings to unlock it.`,
      );
    }
    const subdomain = host === "api-direct" ? "api" : host;
    url = `https://${subdomain}.twilio.com${opts.path}`;
    headers["Authorization"] = `Basic ${btoa(`${sid}:${token}`)}`;
  }

  const init: RequestInit = { method, headers };

  if (method === "GET" || method === "DELETE") {
    const qs = encodeForm(params);
    if (qs) url += (url.includes("?") ? "&" : "?") + qs;
  } else {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = encodeForm(params);
  }

  const response = await fetch(url, init);
  const text = await response.text();

  if (!response.ok) {
    console.error(`Twilio ${method} ${opts.path} failed [${response.status}]: ${text}`);
    throw new TwilioError(response.status, text);
  }
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

/** The Twilio Account SID this app is operating on. */
export async function getAccountSid(): Promise<string> {
  const fromEnv = process.env["TWILIO_ACCOUNT_SID"];
  if (fromEnv) return fromEnv;
  const balance = await twilioRequest<{ account_sid: string }>({ path: "/Balance.json" });
  return balance.account_sid;
}

export function normalizePhone(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("whatsapp:")) return `whatsapp:${normalizePhone(trimmed.slice(9))}`;
  const digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

export function stripChannel(value: string): string {
  return value.replace(/^whatsapp:/, "");
}