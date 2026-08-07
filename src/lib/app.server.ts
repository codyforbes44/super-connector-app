import type { SupabaseClient } from "@supabase/supabase-js";

export const PROJECT_ID = "5b038a02-865b-4cdd-8546-78cf96e0b0aa";
export const PUBLIC_BASE_URL = `https://project--${PROJECT_ID}.lovable.app`;

export function webhookUrl(kind: "sms" | "voice" | "status"): string {
  const token = process.env["TWILIO_WEBHOOK_TOKEN"] ?? "";
  return `${PUBLIC_BASE_URL}/api/public/twilio/${kind}?t=${encodeURIComponent(token)}`;
}

export type Role = "owner" | "admin" | "agent";

export async function getRole(supabase: SupabaseClient, userId: string): Promise<Role> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role as Role);
  if (roles.includes("owner")) return "owner";
  if (roles.includes("admin")) return "admin";
  return "agent";
}

export function isAdminRole(role: Role): boolean {
  return role === "owner" || role === "admin";
}

export async function requireAdmin(supabase: SupabaseClient, userId: string): Promise<Role> {
  const role = await getRole(supabase, userId);
  if (!isAdminRole(role)) throw new Error("Forbidden: this action requires an admin.");
  return role;
}

/** Numbers the caller is allowed to act on. Admins get every number. */
export async function allowedNumbers(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ role: Role; numbers: string[] }> {
  const role = await getRole(supabase, userId);
  const query = supabase.from("phone_numbers").select("phone_number, assigned_to");
  const { data } = isAdminRole(role) ? await query : await query.eq("assigned_to", userId);
  return { role, numbers: (data ?? []).map((n) => n.phone_number as string) };
}

export async function audit(
  admin: SupabaseClient,
  actor: string | null,
  action: string,
  detail: Record<string, unknown> = {},
) {
  await admin.from("audit_log").insert({ actor, action, detail });
}

/** Find or create the conversation row for a message. */
export async function upsertConversation(
  admin: SupabaseClient,
  args: { channel: string; appNumber: string; contactNumber: string },
): Promise<string> {
  const { data: existing } = await admin
    .from("conversations")
    .select("id")
    .eq("channel", args.channel)
    .eq("app_number", args.appNumber)
    .eq("contact_number", args.contactNumber)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data: created, error } = await admin
    .from("conversations")
    .insert({
      channel: args.channel,
      app_number: args.appNumber,
      contact_number: args.contactNumber,
    })
    .select("id")
    .single();
  if (error) throw error;
  return created.id as string;
}