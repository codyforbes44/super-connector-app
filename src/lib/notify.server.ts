import type { SupabaseClient } from "@supabase/supabase-js";

import { appBaseUrl, sendEmail } from "./email.server";
import type { RenderedEmail, TemplateName } from "./email-templates/index";
import { recipientsForNumber, sendPushToUsers } from "./push.server";

export type EmailPrefKey =
  | "email_missed_call"
  | "email_voicemail"
  | "email_inbound_message"
  | "email_ai_summary"
  | "email_account";

type PrefRow = {
  user_id: string;
  email_address: string | null;
  digest_mode: string;
  quiet_hours_enabled: boolean;
  quiet_start: string;
  quiet_end: string;
  timezone: string;
} & Record<EmailPrefKey, boolean>;

function inQuietHours(row: PrefRow, now = new Date()): boolean {
  if (!row.quiet_hours_enabled) return false;
  let local: string;
  try {
    local = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: row.timezone || "UTC",
    }).format(now);
  } catch {
    local = now.toISOString().slice(11, 16);
  }
  const minutes = (v: string) => {
    const [h = "0", m = "0"] = v.split(":");
    return Number(h) * 60 + Number(m);
  };
  const cur = minutes(local);
  const start = minutes(row.quiet_start || "22:00");
  const end = minutes(row.quiet_end || "07:00");
  return start <= end ? cur >= start && cur < end : cur >= start || cur < end;
}

/** Resolve email recipients for a set of users, honouring their preferences. */
export async function emailRecipients(
  admin: SupabaseClient,
  userIds: string[],
  prefKey: EmailPrefKey,
): Promise<string[]> {
  if (!userIds.length) return [];

  const [{ data: prefs }, { data: profiles }] = await Promise.all([
    admin.from("notification_prefs").select("*").in("user_id", userIds),
    admin.from("profiles").select("id, email").in("id", userIds),
  ]);

  const prefById = new Map((prefs ?? []).map((p) => [p.user_id as string, p as PrefRow]));
  const out: string[] = [];

  for (const id of userIds) {
    const row = prefById.get(id);
    // No row yet = defaults (all instant alerts on).
    if (row) {
      if (row[prefKey] === false) continue;
      if (row.digest_mode === "digest") continue;
      if (inQuietHours(row)) continue;
    }
    const address =
      row?.email_address || (profiles ?? []).find((p) => p.id === id)?.email || null;
    if (address) out.push(address as string);
  }
  return [...new Set(out)];
}

type PushPayload = Parameters<typeof sendPushToUsers>[2];

/**
 * Single fan-out for an event on an app number: web push to every device plus
 * a branded email to everyone who wants that alert type by email.
 */
export async function notifyNumber(
  admin: SupabaseClient,
  appNumber: string,
  opts: {
    push?: PushPayload;
    email?: {
      prefKey: EmailPrefKey;
      template: TemplateName;
      render: (baseUrl: string) => RenderedEmail;
      context?: Record<string, unknown>;
      replyTo?: string;
    };
  },
): Promise<void> {
  const users = await recipientsForNumber(admin, appNumber);

  if (opts.push) {
    try {
      await sendPushToUsers(admin, users, opts.push);
    } catch (error) {
      console.error("push fan-out failed", error);
    }
  }

  if (opts.email) {
    try {
      const to = await emailRecipients(admin, users, opts.email.prefKey);
      if (to.length) {
        await sendEmail(admin, {
          to,
          template: opts.email.template,
          rendered: opts.email.render(appBaseUrl()),
          ...(opts.email.context ? { context: opts.email.context } : {}),
          ...(opts.email.replyTo ? { replyTo: opts.email.replyTo } : {}),
        });
      }
    } catch (error) {
      console.error("email fan-out failed", error);
    }
  }
}