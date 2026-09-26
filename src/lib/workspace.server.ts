import type { SupabaseClient } from "@supabase/supabase-js";

export type WorkspaceRole = "owner" | "admin" | "agent";

export type WorkspaceContext = {
  id: string;
  name: string;
  role: WorkspaceRole;
  a2pGrandfathered: boolean;
  businessName: string | null;
  website: string | null;
  hours: string | null;
  aiGreeting: string | null;
  verifiedPhone: string | null;
};

type MemberRow = {
  workspace_id: string;
  role: string;
  created_at: string;
  workspaces:
    | {
        name: string;
        a2p_grandfathered: boolean;
        business_name: string | null;
        website: string | null;
        hours: string | null;
        ai_greeting: string | null;
        verified_phone: string | null;
      }
    | Array<{
        name: string;
        a2p_grandfathered: boolean;
        business_name: string | null;
        website: string | null;
        hours: string | null;
        ai_greeting: string | null;
        verified_phone: string | null;
      }>
    | null;
};

function asRole(value: string): WorkspaceRole | null {
  if (value === "owner" || value === "admin" || value === "agent") return value;
  return null;
}

function rank(role: WorkspaceRole): number {
  switch (role) {
    case "owner":
      return 0;
    case "admin":
      return 1;
    case "agent":
      return 2;
    default: {
      const unreachable: never = role;
      return unreachable;
    }
  }
}

async function adminClient(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

function flattenWorkspace(row: MemberRow): WorkspaceContext | null {
  const role = asRole(row.role);
  if (!role) return null;
  const related = Array.isArray(row.workspaces) ? row.workspaces[0] : row.workspaces;
  if (!related) return null;
  return {
    id: row.workspace_id,
    name: related.name,
    role,
    a2pGrandfathered: related.a2p_grandfathered,
    businessName: related.business_name,
    website: related.website,
    hours: related.hours,
    aiGreeting: related.ai_greeting,
    verifiedPhone: related.verified_phone,
  };
}

/**
 * The signed-in user's workspace. Never accepts a workspace id from the client.
 * If they belong to more than one, the workspace they own wins.
 */
export async function resolveWorkspaceForUser(userId: string): Promise<WorkspaceContext | null> {
  const admin = await adminClient();
  const { data, error } = await admin
    .from("workspace_members")
    .select(
      "workspace_id, role, created_at, workspaces(name, a2p_grandfathered, business_name, website, hours, ai_greeting, verified_phone)",
    )
    .eq("user_id", userId);
  if (error) {
    console.error("workspace lookup failed", error.message);
    return null;
  }
  const contexts = ((data ?? []) as MemberRow[])
    .map(flattenWorkspace)
    .filter((row): row is WorkspaceContext => row !== null)
    .sort((a, b) => rank(a.role) - rank(b.role));
  return contexts[0] ?? null;
}

export async function requireWorkspace(userId: string): Promise<WorkspaceContext> {
  const workspace = await resolveWorkspaceForUser(userId);
  if (!workspace) {
    throw new Error("Create your workspace before doing this.");
  }
  return workspace;
}

export async function requireWorkspaceOwner(userId: string): Promise<WorkspaceContext> {
  const workspace = await requireWorkspace(userId);
  if (workspace.role !== "owner") {
    throw new Error("Forbidden: this action requires the account owner.");
  }
  return workspace;
}

/** The workspace that owns a SixVox number. Webhooks use this, never a client id. */
export async function resolveWorkspaceIdForNumber(phoneNumber: string): Promise<{
  workspaceId: string | null;
  phoneNumberId: string | null;
  assignedTo: string | null;
}> {
  const admin = await adminClient();
  const { data } = await admin
    .from("phone_numbers")
    .select("id, workspace_id, assigned_to")
    .eq("phone_number", phoneNumber)
    .maybeSingle();
  return {
    workspaceId: (data?.["workspace_id"] as string | null) ?? null,
    phoneNumberId: (data?.["id"] as string | null) ?? null,
    assignedTo: (data?.["assigned_to"] as string | null) ?? null,
  };
}

export async function recordActivation(
  workspaceId: string,
  event: "signup" | "number_claimed" | "first_inbound_answered",
  detail: Record<string, unknown> = {},
): Promise<void> {
  const admin = await adminClient();
  const { count } = await admin
    .from("activation_events")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("event", event);
  if ((count ?? 0) > 0) return;
  await admin.from("activation_events").insert({ workspace_id: workspaceId, event, detail });
}
