/** Persistence and notifications for concierge conversations. */

import type { SupabaseClient } from "@supabase/supabase-js";

import { PUBLIC_BASE_URL } from "@/lib/app.server";

export type ConversationRow = {
  id: string;
  user_id: string | null;
  page: string | null;
  mode: string;
  dynamic_variables: Record<string, unknown>;
};

export async function createConversation(
  admin: SupabaseClient,
  input: {
    sessionKey: string;
    userId: string | null;
    mode: "voice" | "text";
    page: string | null;
    referrer: string | null;
    variables: Record<string, unknown>;
  },
): Promise<string> {
  const { data, error } = await admin
    .from("chat_conversations")
    .insert({
      session_id: input.sessionKey,
      user_id: input.userId,
      mode: input.mode,
      page: input.page,
      referrer: input.referrer,
      dynamic_variables: input.variables,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Resolve a session key to its conversation row. Returns null when unknown. */
export async function conversationForKey(
  admin: SupabaseClient,
  sessionKey: string,
): Promise<ConversationRow | null> {
  if (!sessionKey) return null;
  const { data, error } = await admin
    .from("chat_conversations")
    .select("id, user_id, page, mode, dynamic_variables")
    .eq("session_id", sessionKey)
    .maybeSingle();
  if (error) {
    console.error("concierge: conversation lookup failed", error);
    return null;
  }
  return (data as ConversationRow | null) ?? null;
}

export async function logToolCall(
  admin: SupabaseClient,
  conversationId: string,
  toolName: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin.from("chat_messages").insert({
    conversation_id: conversationId,
    role: "tool",
    content: toolName,
    tool_name: toolName,
    tool_payload: payload,
  });
  if (error) console.error("concierge: tool log failed", error);
}

export async function saveTranscript(
  admin: SupabaseClient,
  conversationId: string,
  turns: Array<{ role: string; content: string; at?: number }>,
): Promise<void> {
  await admin.from("chat_messages").delete().eq("conversation_id", conversationId).neq("role", "tool");
  if (!turns.length) return;
  const { error } = await admin.from("chat_messages").insert(
    turns.map((turn) => ({
      conversation_id: conversationId,
      role: turn.role,
      content: turn.content,
      at_seconds: turn.at ?? null,
    })),
  );
  if (error) console.error("concierge: transcript insert failed", error);
}

/** Everyone who should hear about a new lead, callback or handoff. */
export async function teamRecipients(admin: SupabaseClient): Promise<string[]> {
  const { data: roles } = await admin
    .from("user_roles")
    .select("user_id, role")
    .in("role", ["owner", "super_admin"]);
  const ids = (roles ?? []).map((row) => row["user_id"] as string);
  if (!ids.length) return [];
  const { data: profiles } = await admin.from("profiles").select("email").in("id", ids);
  return (profiles ?? [])
    .map((row) => (row["email"] as string | null) ?? "")
    .filter((email): email is string => Boolean(email));
}

type Alert = {
  eyebrow: string;
  title: string;
  intro: string;
  rows: Array<{ label: string; value: string }>;
  cta?: { label: string; path: string };
};

/** Branded internal alert for the SixVox team. */
export async function alertTeam(admin: SupabaseClient, alert: Alert): Promise<void> {
  const recipients = await teamRecipients(admin);
  if (!recipients.length) return;

  const [{ sendEmail, FROM_ALERTS }, { BRAND, button, layout, metaTable, paragraph }] =
    await Promise.all([import("@/lib/email.server"), import("@/lib/email-templates/layout")]);

  const body =
    paragraph(alert.intro) +
    metaTable(alert.rows) +
    (alert.cta
      ? button(alert.cta.label, `${PUBLIC_BASE_URL}${alert.cta.path}`)
      : paragraph(`<span style="color:${BRAND.muted};font-size:13px;">From the website concierge.</span>`));

  await sendEmail(admin, {
    to: recipients,
    template: "account",
    from: FROM_ALERTS,
    context: { source: "concierge", kind: alert.eyebrow },
    rendered: {
      subject: `SixVox · ${alert.eyebrow}: ${alert.title}`,
      html: layout({
        preheader: alert.intro.slice(0, 120),
        eyebrow: alert.eyebrow,
        title: alert.title,
        body,
      }),
    },
  });
}
