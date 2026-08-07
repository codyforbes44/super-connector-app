import type { SupabaseClient } from "@supabase/supabase-js";

import { requireAdmin } from "./app.server";

type SB = SupabaseClient;

export type ForwardingRow = {
  id: string;
  user_id: string;
  personal_number: string;
  carrier: string | null;
  forward_mode: string;
  assigned_number: string | null;
  status: string;
  verified_at: string | null;
  last_forwarded_call_at: string | null;
};

function normalize(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) throw new Error("Enter your phone number.");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export async function getForwarding(supabase: SB, userId: string) {
  const { data } = await supabase
    .from("byo_numbers")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as ForwardingRow | null) ?? null;
}

export async function saveForwarding(
  supabase: SB,
  userId: string,
  input: {
    personalNumber: string;
    carrier: string;
    forwardMode: "conditional" | "all";
    assignedNumber: string | null;
  },
) {
  const personal = normalize(input.personalNumber);
  const existing = await getForwarding(supabase, userId);
  const patch = {
    user_id: userId,
    personal_number: personal,
    carrier: input.carrier,
    forward_mode: input.forwardMode,
    assigned_number: input.assignedNumber,
    status: existing?.status === "verified" ? "verified" : "pending",
  };
  const { data, error } = await supabase
    .from("byo_numbers")
    .upsert(patch, { onConflict: "user_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data as ForwardingRow;
}

export async function stopForwarding(supabase: SB, userId: string) {
  const { error } = await supabase
    .from("byo_numbers")
    .update({ status: "off" })
    .eq("user_id", userId);
  if (error) throw error;
  return { ok: true };
}

/** Admin: every forwarding setup, for the account pages. */
export async function listForwarding(supabase: SB, userId: string) {
  await requireAdmin(supabase, userId);
  const { data } = await supabase
    .from("byo_numbers")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as ForwardingRow[];
}

/** Admin: mark a member's forwarding as working when they confirm by phone. */
export async function setForwardingStatus(
  supabase: SB,
  userId: string,
  input: { targetUserId: string; status: "pending" | "verified" | "off" },
) {
  await requireAdmin(supabase, userId);
  const { error } = await supabase
    .from("byo_numbers")
    .update({
      status: input.status,
      verified_at: input.status === "verified" ? new Date().toISOString() : null,
    })
    .eq("user_id", input.targetUserId);
  if (error) throw error;
  return { ok: true };
}

/** Called from the inbound webhook with the service-role client. */
export async function noteForwardedCall(admin: SB, appNumber: string) {
  const now = new Date().toISOString();
  const { data } = await admin
    .from("byo_numbers")
    .select("id, status")
    .eq("assigned_number", appNumber)
    .maybeSingle();
  if (!data) return;
  await admin
    .from("byo_numbers")
    .update({
      last_forwarded_call_at: now,
      status: data.status === "off" ? "off" : "verified",
      verified_at: data.status === "verified" ? undefined : now,
    })
    .eq("id", data.id as string);
}