/** Admin-side reads and actions for the website concierge. */

import type { SupabaseClient } from "@supabase/supabase-js";

import { requireAdmin } from "@/lib/app.server";

export type ConciergeConversation = {
  id: string;
  createdAt: string;
  page: string | null;
  mode: string;
  status: string | null;
  outcome: string | null;
  summary: string | null;
  answered: boolean | null;
  handoff: boolean;
  turns: number | null;
  seconds: number | null;
  signedIn: boolean;
  unanswered: string[];
};

export type ConciergeLead = {
  id: string;
  conversationId: string | null;
  createdAt: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  need: string | null;
  urgency: string | null;
  planInterest: string | null;
  quality: string | null;
  handled: boolean;
};

export type ConciergeCallback = {
  id: string;
  conversationId: string | null;
  createdAt: string;
  name: string | null;
  phone: string;
  email: string | null;
  window: string;
  timezone: string | null;
  topic: string | null;
  status: string;
};

export type ConciergeOverview = {
  conversations: ConciergeConversation[];
  leads: ConciergeLead[];
  callbacks: ConciergeCallback[];
  stats: {
    conversations: number;
    leads: number;
    callbacks: number;
    handoffs: number;
    unanswered: number;
  };
};

export async function overview(
  supabase: SupabaseClient,
  userId: string,
): Promise<ConciergeOverview> {
  await requireAdmin(supabase, userId);

  const [{ data: conversations }, { data: leads }, { data: callbacks }] = await Promise.all([
    supabase
      .from("chat_conversations")
      .select(
        "id, created_at, page, mode, status, outcome, summary, answered, handoff_requested, turn_count, duration_seconds, user_id, unanswered_questions",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("chat_leads").select("*").order("created_at", { ascending: false }).limit(100),
    supabase
      .from("chat_callbacks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const rows = (conversations ?? []).map((row) => ({
    id: row["id"] as string,
    createdAt: row["created_at"] as string,
    page: (row["page"] as string | null) ?? null,
    mode: (row["mode"] as string) ?? "text",
    status: (row["status"] as string | null) ?? null,
    outcome: (row["outcome"] as string | null) ?? null,
    summary: (row["summary"] as string | null) ?? null,
    answered: (row["answered"] as boolean | null) ?? null,
    handoff: Boolean(row["handoff_requested"]),
    turns: (row["turn_count"] as number | null) ?? null,
    seconds: (row["duration_seconds"] as number | null) ?? null,
    signedIn: Boolean(row["user_id"]),
    unanswered: ((row["unanswered_questions"] as string[] | null) ?? []).filter(Boolean),
  }));

  return {
    conversations: rows,
    leads: (leads ?? []).map((row) => ({
      id: row["id"] as string,
      conversationId: (row["conversation_id"] as string | null) ?? null,
      createdAt: row["created_at"] as string,
      name: (row["name"] as string | null) ?? null,
      email: (row["email"] as string | null) ?? null,
      phone: (row["phone"] as string | null) ?? null,
      company: (row["company"] as string | null) ?? null,
      need: (row["need"] as string | null) ?? null,
      urgency: (row["urgency"] as string | null) ?? null,
      planInterest: (row["plan_interest"] as string | null) ?? null,
      quality: (row["quality"] as string | null) ?? null,
      handled: Boolean(row["handled"]),
    })),
    callbacks: (callbacks ?? []).map((row) => ({
      id: row["id"] as string,
      conversationId: (row["conversation_id"] as string | null) ?? null,
      createdAt: row["created_at"] as string,
      name: (row["name"] as string | null) ?? null,
      phone: row["phone"] as string,
      email: (row["email"] as string | null) ?? null,
      window: (row["window_label"] as string) ?? "",
      timezone: (row["timezone"] as string | null) ?? null,
      topic: (row["topic"] as string | null) ?? null,
      status: (row["status"] as string) ?? "pending",
    })),
    stats: {
      conversations: rows.length,
      leads: (leads ?? []).length,
      callbacks: (callbacks ?? []).length,
      handoffs: rows.filter((row) => row.handoff).length,
      unanswered: rows.filter((row) => row.unanswered.length).length,
    },
  };
}

export type TranscriptTurn = {
  role: string;
  content: string;
  toolName: string | null;
  toolPayload: Record<string, unknown> | null;
  at: number | null;
};

export async function transcript(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
): Promise<TranscriptTurn[]> {
  await requireAdmin(supabase, userId);
  const { data } = await supabase
    .from("chat_messages")
    .select("role, content, tool_name, tool_payload, at_seconds, created_at")
    .eq("conversation_id", conversationId)
    .order("at_seconds", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });
  return (data ?? []).map((row) => ({
    role: row["role"] as string,
    content: (row["content"] as string | null) ?? "",
    toolName: (row["tool_name"] as string | null) ?? null,
    toolPayload: (row["tool_payload"] as Record<string, unknown> | null) ?? null,
    at: (row["at_seconds"] as number | null) ?? null,
  }));
}

export async function markLeadHandled(
  supabase: SupabaseClient,
  userId: string,
  input: { id: string; handled: boolean },
): Promise<{ ok: true }> {
  await requireAdmin(supabase, userId);
  const { error } = await supabase
    .from("chat_leads")
    .update({ handled: input.handled })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function setCallbackStatus(
  supabase: SupabaseClient,
  userId: string,
  input: { id: string; status: "pending" | "done" | "cancelled" },
): Promise<{ ok: true }> {
  await requireAdmin(supabase, userId);
  const { error } = await supabase
    .from("chat_callbacks")
    .update({ status: input.status })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function sync(supabase: SupabaseClient, userId: string) {
  await requireAdmin(supabase, userId);
  const { syncConciergeAgent } = await import("./sync.server");
  return syncConciergeAgent();
}
