/**
 * Server-only access layer for Lovable connector-gateway backed services
 * (Resend, Gmail, Google Calendar, Google Maps).
 */

const GATEWAY = "https://connector-gateway.lovable.dev";

export class ConnectorError extends Error {
  status: number;
  body: string;
  connector: string;
  constructor(connector: string, status: number, body: string) {
    super(`${connector} request failed [${status}]: ${body}`);
    this.connector = connector;
    this.status = status;
    this.body = body;
  }
}

const KEY_ENV: Record<string, string> = {
  resend: "RESEND_API_KEY",
  google_mail: "GOOGLE_MAIL_API_KEY",
  google_calendar: "GOOGLE_CALENDAR_API_KEY",
  google_maps: "GOOGLE_MAPS_API_KEY",
};

export function connectorConfigured(connector: keyof typeof KEY_ENV | string): boolean {
  const env = KEY_ENV[connector];
  return Boolean(env && process.env[env] && process.env["LOVABLE_API_KEY"]);
}

/** Low-level gateway call. `path` must start with "/". */
export async function gatewayRequest<T = unknown>(opts: {
  connector: keyof typeof KEY_ENV | string;
  path: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, string | number | boolean | undefined | null>;
  json?: unknown;
  headers?: Record<string, string>;
  raw?: boolean;
}): Promise<T> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const envName = KEY_ENV[opts.connector];
  const connectionKey = envName ? process.env[envName] : undefined;
  if (!lovableKey || !connectionKey) {
    throw new ConnectorError(
      String(opts.connector),
      412,
      `The ${opts.connector} connection is not linked to this project yet.`,
    );
  }

  const url = new URL(`${GATEWAY}/${opts.connector}${opts.path}`);
  for (const [key, value] of Object.entries(opts.query ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connectionKey,
    Accept: "application/json",
    ...(opts.headers ?? {}),
  };
  if (opts.json !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(url.toString(), {
    method: opts.method ?? "GET",
    headers,
    body: opts.json === undefined ? undefined : JSON.stringify(opts.json),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`Connector ${opts.connector} ${opts.path} -> ${res.status}: ${text}`);
    throw new ConnectorError(String(opts.connector), res.status, text);
  }
  if (opts.raw) return text as unknown as T;
  return (text ? JSON.parse(text) : {}) as T;
}