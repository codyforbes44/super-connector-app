import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

/**
 * Whether any signed-in device reported the native call UI for this call.
 * `null` means the lookup failed (migration not applied, network). Callers
 * must not ring a personal cell on `null`.
 */
export async function inboundDeviceAcked(admin: Admin, callSid: string): Promise<boolean | null> {
  if (!callSid) return false;
  const { data, error } = await admin
    .from("mobile_call_acks")
    .select("call_sid")
    .eq("call_sid", callSid)
    .maybeSingle();
  if (error) {
    console.error("mobile call ack lookup failed", error.message);
    return null;
  }
  return Boolean(data);
}

/**
 * Cell to ring when the app does not acknowledge. Prefer the number's
 * assignee, then an account owner. Returns null when nobody has a cell on file.
 */
export async function ownerCellForNumber(
  admin: Admin,
  input: { assignedTo: string | null },
): Promise<string | null> {
  const ids: string[] = [];
  if (input.assignedTo) ids.push(input.assignedTo);

  const { data: owners, error: ownerError } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("role", "owner");
  if (ownerError) {
    console.error("owner lookup for PSTN fallback failed", ownerError.message);
    return null;
  }
  for (const row of owners ?? []) {
    if (!ids.includes(row.user_id)) ids.push(row.user_id);
  }
  if (!ids.length) return null;

  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("id, agent_phone")
    .in("id", ids);
  if (profileError) {
    console.error("profile lookup for PSTN fallback failed", profileError.message);
    return null;
  }
  const byId = new Map((profiles ?? []).map((row) => [row.id, row.agent_phone]));
  for (const id of ids) {
    const phone = byId.get(id);
    if (phone) return phone;
  }
  return null;
}
