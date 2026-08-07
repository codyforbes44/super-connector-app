/**
 * Per-user Gmail access through the Lovable App User Connector.
 * Every call runs as the signed-in app user's own Google account.
 * Server-only.
 */
import { callAsAppUser } from "@/integrations/lovable/appUserConnector";

import { getConnectionKeyForUser } from "./app-user-connections.server";

export const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
export const GMAIL_CONNECTOR_ID = "google_mail";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
];

export const GMAIL_SCOPE_LABELS = [
  { scope: "userinfo.email", label: "Your Google email address" },
  { scope: "userinfo.profile", label: "Your basic Google profile" },
  { scope: "gmail.readonly", label: "Read your mail (notifications and threads)" },
  { scope: "gmail.send", label: "Send mail on your behalf" },
];

const BASE = "/gmail/v1/users/me";

export class GmailNotConnected extends Error {
  constructor() {
    super("Gmail is not connected for this user.");
  }
}

async function api<T>(
  userId: string,
  path: string,
  init?: RequestInit & { query?: Record<string, string | number | undefined> },
): Promise<T> {
  const connectionAPIKey = await getConnectionKeyForUser(userId, GMAIL_CONNECTOR_ID);
  if (!connectionAPIKey) throw new GmailNotConnected();

  let full = path;
  const query = init?.query;
  if (query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === "") continue;
      params.set(k, String(v));
    }
    const qs = params.toString();
    if (qs) full += `?${qs}`;
  }

  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey,
    connectorId: GMAIL_CONNECTOR_ID,
    path: full,
    ...(init ? { init: { method: init.method ?? "GET", body: init.body, headers: init.headers } } : {}),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Gmail (app user) ${path} -> ${res.status}: ${text}`);
    throw new Error(`Gmail request failed [${res.status}]: ${text.slice(0, 300)}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

type GmailHeader = { name: string; value: string };
type GmailPart = { mimeType?: string; body?: { data?: string }; parts?: GmailPart[] };
type GmailMessage = {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: GmailPart & { headers?: GmailHeader[] };
};

export type MailSummary = {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
};

function header(msg: GmailMessage, name: string): string {
  return msg.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decode(data: string): string {
  try {
    const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
    return new TextDecoder().decode(Uint8Array.from(atob(normalized), (c) => c.charCodeAt(0)));
  } catch {
    return "";
  }
}

function extractBody(part?: GmailPart): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return decode(part.body.data);
  for (const child of part.parts ?? []) {
    const found = extractBody(child);
    if (found) return found;
  }
  if (part.mimeType === "text/html" && part.body?.data) {
    return decode(part.body.data)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return "";
}

function toSummary(msg: GmailMessage): MailSummary {
  return {
    id: msg.id,
    threadId: msg.threadId,
    from: header(msg, "From"),
    to: header(msg, "To"),
    subject: header(msg, "Subject") || "(no subject)",
    snippet: msg.snippet ?? "",
    date: msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : header(msg, "Date"),
    unread: (msg.labelIds ?? []).includes("UNREAD"),
  };
}

export async function profile(userId: string) {
  return api<{ emailAddress: string; messagesTotal: number; threadsTotal: number }>(
    userId,
    `${BASE}/profile`,
  );
}

export async function listMessages(
  userId: string,
  opts: { q?: string; max?: number },
): Promise<MailSummary[]> {
  const max = opts.max ?? 12;
  const list = await api<{ messages?: Array<{ id: string }> }>(userId, `${BASE}/messages`, {
    query: { maxResults: max, q: opts.q ?? "" },
  });
  const ids = (list.messages ?? []).slice(0, max);
  const detailed = await Promise.all(
    ids.map((m) =>
      api<GmailMessage>(userId, `${BASE}/messages/${m.id}`, {
        query: { format: "metadata" },
      }).catch(() => null),
    ),
  );
  return detailed.filter(Boolean).map((m) => toSummary(m as GmailMessage));
}

export async function getThread(userId: string, threadId: string) {
  const thread = await api<{ id: string; messages?: GmailMessage[] }>(
    userId,
    `${BASE}/threads/${threadId}`,
    { query: { format: "full" } },
  );
  return {
    id: thread.id,
    messages: (thread.messages ?? []).map((m) => ({ ...toSummary(m), body: extractBody(m.payload) })),
  };
}

function base64url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sendMail(
  userId: string,
  opts: { to: string; subject: string; body: string; threadId?: string; inReplyTo?: string },
) {
  const lines = [
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
  ];
  if (opts.inReplyTo) lines.push(`In-Reply-To: ${opts.inReplyTo}`, `References: ${opts.inReplyTo}`);
  lines.push("", opts.body);

  const payload: Record<string, unknown> = { raw: base64url(lines.join("\r\n")) };
  if (opts.threadId) payload["threadId"] = opts.threadId;

  return api<{ id: string; threadId: string }>(userId, `${BASE}/messages/send`, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
  });
}