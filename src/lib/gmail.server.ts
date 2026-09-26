import { connectorConfigured, gatewayRequest } from "./connectors.server";

const BASE = "/gmail/v1/users/me";

export function gmailConfigured(): boolean {
  return connectorConfigured("google_mail");
}

type GmailHeader = { name: string; value: string };
type GmailPart = {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
};
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
  const found = msg.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return found?.value ?? "";
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

export async function listMessages(opts: { q?: string; max?: number }): Promise<MailSummary[]> {
  const list = await gatewayRequest<{ messages?: Array<{ id: string }> }>({
    connector: "google_mail",
    path: `${BASE}/messages`,
    query: { maxResults: opts.max ?? 12, q: opts.q ?? "" },
  });
  const ids = (list.messages ?? []).slice(0, opts.max ?? 12);
  const detailed = await Promise.all(
    ids.map((m) =>
      gatewayRequest<GmailMessage>({
        connector: "google_mail",
        path: `${BASE}/messages/${m.id}`,
        query: { format: "metadata" },
      }).catch(() => null),
    ),
  );
  return detailed.filter(Boolean).map((m) => toSummary(m as GmailMessage));
}

export async function getThread(threadId: string) {
  const thread = await gatewayRequest<{ id: string; messages?: GmailMessage[] }>({
    connector: "google_mail",
    path: `${BASE}/threads/${threadId}`,
    query: { format: "full" },
  });
  return {
    id: thread.id,
    messages: (thread.messages ?? []).map((m) => ({
      ...toSummary(m),
      body: extractBody(m.payload),
    })),
  };
}

function base64url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
}) {
  const lines = [
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
  ];
  if (opts.inReplyTo) {
    lines.push(`In-Reply-To: ${opts.inReplyTo}`, `References: ${opts.inReplyTo}`);
  }
  lines.push("", opts.body);

  const payload: Record<string, unknown> = { raw: base64url(lines.join("\r\n")) };
  if (opts.threadId) payload["threadId"] = opts.threadId;

  return gatewayRequest<{ id: string; threadId: string }>({
    connector: "google_mail",
    path: `${BASE}/messages/send`,
    method: "POST",
    json: payload,
  });
}

export async function mailboxProfile() {
  return gatewayRequest<{ emailAddress: string; messagesTotal: number; threadsTotal: number }>({
    connector: "google_mail",
    path: `${BASE}/profile`,
  });
}
