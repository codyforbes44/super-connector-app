import type { SupabaseClient } from "@supabase/supabase-js";

import { PUBLIC_BASE_URL } from "./app.server";
import { ConnectorError, connectorConfigured, gatewayRequest } from "./connectors.server";
import { toPlainText } from "./email-templates/layout";
import type { RenderedEmail, TemplateName } from "./email-templates/index";

/** Verified Resend sending domain for this workspace. */
export const SENDING_DOMAIN = "bookme.bet";
export const FROM_ALERTS = `Signalbox Alerts <alerts@${SENDING_DOMAIN}>`;
export const FROM_ACCOUNT = `Signalbox <team@${SENDING_DOMAIN}>`;

export function emailConfigured(): boolean {
  return connectorConfigured("resend");
}

export function appBaseUrl(): string {
  return PUBLIC_BASE_URL;
}

type SendArgs = {
  to: string | string[];
  template: TemplateName;
  rendered: RenderedEmail;
  from?: string;
  replyTo?: string;
  context?: Record<string, unknown>;
};

/** Send one email through the Resend connector and log the outcome. */
export async function sendEmail(
  admin: SupabaseClient | null,
  args: SendArgs,
): Promise<{ sent: boolean; id?: string; error?: string }> {
  const recipients = (Array.isArray(args.to) ? args.to : [args.to]).filter(Boolean);
  if (!recipients.length) return { sent: false, error: "no recipient" };

  const log = async (status: string, providerId?: string, error?: string) => {
    if (!admin) return;
    try {
      await admin.from("email_log").insert({
        template: args.template,
        to_address: recipients.join(", "),
        subject: args.rendered.subject,
        provider_id: providerId ?? null,
        status,
        error: error ?? null,
        context: args.context ?? {},
      });
    } catch (e) {
      console.error("email_log insert failed", e);
    }
  };

  if (!emailConfigured()) {
    await log("skipped", undefined, "Resend connection not configured");
    return { sent: false, error: "Resend is not connected." };
  }

  try {
    const payload: Record<string, unknown> = {
      from: args.from ?? FROM_ALERTS,
      to: recipients,
      subject: args.rendered.subject,
      html: args.rendered.html,
      text: toPlainText(args.rendered.html).slice(0, 4000),
    };
    if (args.replyTo) payload["reply_to"] = args.replyTo;

    const res = await gatewayRequest<{ id?: string }>({
      connector: "resend",
      path: "/emails",
      method: "POST",
      json: payload,
    });
    await log("sent", res?.id);
    return { sent: true, ...(res?.id ? { id: res.id } : {}) };
  } catch (error) {
    const message =
      error instanceof ConnectorError ? `${error.status}: ${error.body}` : String(error);
    await log("failed", undefined, message.slice(0, 800));
    return { sent: false, error: message };
  }
}

/** Domain + recent activity, for the Settings screen. */
export type EmailLogRow = {
  id: string;
  template: string;
  to_address: string;
  subject: string;
  status: string;
  created_at: string;
  error: string | null;
};

export type EmailStatus = {
  connected: boolean;
  domain: string;
  verified: boolean;
  domainStatus: string;
  recent: EmailLogRow[];
};

export async function emailStatus(admin: SupabaseClient): Promise<EmailStatus> {
  if (!emailConfigured()) {
    return {
      connected: false,
      domain: SENDING_DOMAIN,
      verified: false,
      domainStatus: "not configured",
      recent: [],
    };
  }
  let verified = false;
  let domainStatus = "unknown";
  try {
    const res = await gatewayRequest<{ data?: Array<{ name: string; status: string }> }>({
      connector: "resend",
      path: "/domains",
    });
    const match = (res.data ?? []).find((d) => d.name === SENDING_DOMAIN);
    verified = match?.status === "verified";
    domainStatus = match?.status ?? "not found";
  } catch (error) {
    console.error("Resend domain check failed", error);
  }

  const { data: recent } = await admin
    .from("email_log")
    .select("id, template, to_address, subject, status, created_at, error")
    .order("created_at", { ascending: false })
    .limit(15);

  return {
    connected: true,
    domain: SENDING_DOMAIN,
    verified,
    domainStatus,
    recent: (recent ?? []) as EmailLogRow[],
  };
}