import type { SupabaseClient } from "@supabase/supabase-js";

import { publicBaseUrl } from "./runtime-env";

export const PROJECT_ID = "5b038a02-865b-4cdd-8546-78cf96e0b0aa";
/** Captured at process start. Prefer `publicBaseUrl()` when the environment can change. */
export const PUBLIC_BASE_URL = publicBaseUrl();

export function webhookUrl(
  kind: "sms" | "voice" | "status" | "app-voice" | "voice-fallback" | "recording",
): string {
  const token = process.env["TWILIO_WEBHOOK_TOKEN"] ?? "";
  return `${publicBaseUrl()}/api/public/twilio/${kind}?t=${encodeURIComponent(token)}`;
}

export type Role = "super_admin" | "owner" | "admin" | "agent";

export async function getRole(supabase: SupabaseClient, userId: string): Promise<Role> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role as Role);
  if (roles.includes("super_admin")) return "super_admin";
  if (roles.includes("owner")) return "owner";
  if (roles.includes("admin")) return "admin";
  return "agent";
}

export function isAdminRole(role: Role): boolean {
  return role === "super_admin" || role === "owner" || role === "admin";
}

/** Owner-level: the account owner and the platform super admin only. */
export function isOwnerRole(role: Role): boolean {
  return role === "super_admin" || role === "owner";
}

export async function requireAdmin(supabase: SupabaseClient, userId: string): Promise<Role> {
  const role = await getRole(supabase, userId);
  if (role === "super_admin") return role;
  const { resolveWorkspaceForUser } = await import("./workspace.server");
  const workspace = await resolveWorkspaceForUser(userId);
  if (workspace?.role === "owner" || workspace?.role === "admin") {
    return workspace.role;
  }
  if (isAdminRole(role)) return role;
  throw new Error("Forbidden: this action requires an admin.");
}

/** Guard for critical settings and destructive admin endpoints. */
export async function requireOwner(supabase: SupabaseClient, userId: string): Promise<Role> {
  const role = await getRole(supabase, userId);
  if (role === "super_admin") return role;
  const { resolveWorkspaceForUser } = await import("./workspace.server");
  const workspace = await resolveWorkspaceForUser(userId);
  if (workspace?.role === "owner") return "owner";
  if (isOwnerRole(role)) return role;
  throw new Error("Forbidden: this action requires the account owner.");
}

/**
 * Numbers the caller may act on, limited to their workspace.
 * Workspace owners and admins see every number in that workspace.
 * The workspace comes from membership, never from client input.
 */
export async function allowedNumbers(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ role: Role; numbers: string[] }> {
  const role = await getRole(supabase, userId);
  const { resolveWorkspaceForUser } = await import("./workspace.server");
  const workspace = await resolveWorkspaceForUser(userId);
  const workspaceRole = workspace?.role;
  const canSeeAll =
    workspaceRole === "owner" || workspaceRole === "admin" || role === "super_admin";
  let query = supabase.from("phone_numbers").select("phone_number, assigned_to, workspace_id");
  if (workspace) query = query.eq("workspace_id", workspace.id);
  const { data } = canSeeAll ? await query : await query.eq("assigned_to", userId);
  return { role, numbers: (data ?? []).map((n) => n.phone_number) };
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
  args: { channel: string; appNumber: string; contactNumber: string; workspaceId?: string | null },
): Promise<string> {
  let workspaceId = args.workspaceId ?? null;
  if (!workspaceId) {
    const { data: number } = await admin
      .from("phone_numbers")
      .select("workspace_id")
      .eq("phone_number", args.appNumber)
      .maybeSingle();
    workspaceId = (number?.["workspace_id"] as string | null) ?? null;
  }

  let lookup = admin
    .from("conversations")
    .select("id")
    .eq("channel", args.channel)
    .eq("app_number", args.appNumber)
    .eq("contact_number", args.contactNumber);
  if (workspaceId) lookup = lookup.eq("workspace_id", workspaceId);
  const { data: existing } = await lookup.maybeSingle();
  if (existing) return existing.id as string;

  const { data: created, error } = await admin
    .from("conversations")
    .insert({
      channel: args.channel,
      app_number: args.appNumber,
      contact_number: args.contactNumber,
      ...(workspaceId ? { workspace_id: workspaceId } : {}),
    })
    .select("id")
    .single();
  if (error) throw error;
  return created.id as string;
}
