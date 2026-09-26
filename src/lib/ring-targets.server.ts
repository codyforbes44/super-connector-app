import type { SupabaseClient } from "@supabase/supabase-js";

import { planInboundRing, type InboundRingPlan, type PresenceHit } from "./ring-targets";

type Admin = SupabaseClient;

export type LoadedRing = InboundRingPlan & { workspaceId: string | null };

/**
 * Resolve the called number to its workspace, then ring only present members
 * assigned to that number. Falls back to the owner cell, then AI, then voicemail.
 */
export async function loadInboundRing(
  admin: Admin,
  input: { appNumber: string; aiEnabled: boolean; forwardTo?: string | null },
): Promise<LoadedRing> {
  const { data: number } = await admin
    .from("phone_numbers")
    .select("id, workspace_id, assigned_to, forward_to")
    .eq("phone_number", input.appNumber)
    .maybeSingle();

  const workspaceId = (number?.["workspace_id"] as string | null) ?? null;
  const phoneNumberId = (number?.["id"] as string | null) ?? null;
  let assignedUserIds: string[] = [];

  if (phoneNumberId) {
    const { data: assignees, error } = await admin
      .from("number_assignees")
      .select("user_id")
      .eq("phone_number_id", phoneNumberId);
    if (!error) {
      assignedUserIds = (assignees ?? []).map((row) => row["user_id"] as string);
    }
  }
  if (assignedUserIds.length === 0 && number?.["assigned_to"]) {
    assignedUserIds = [number["assigned_to"] as string];
  }

  const presence: PresenceHit[] = [];
  if (workspaceId && assignedUserIds.length > 0) {
    const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data } = await admin
      .from("voice_presence")
      .select("user_id, identity, workspace_id, last_seen_at")
      .in("user_id", assignedUserIds)
      .gt("last_seen_at", since);
    for (const row of data ?? []) {
      presence.push({
        userId: row["user_id"] as string,
        workspaceId: (row["workspace_id"] as string | null) ?? null,
        identity: row["identity"] as string,
        lastSeenAt: row["last_seen_at"] as string,
      });
    }
  }

  let ownerCell = input.forwardTo?.trim() || (number?.["forward_to"] as string | null) || null;
  if (!ownerCell && workspaceId) {
    const { data: owners } = await admin
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId)
      .eq("role", "owner")
      .limit(1);
    const ownerId = owners?.[0]?.["user_id"] as string | undefined;
    if (ownerId) {
      const { data: profile } = await admin
        .from("profiles")
        .select("agent_phone")
        .eq("id", ownerId)
        .maybeSingle();
      ownerCell = (profile?.["agent_phone"] as string | null) ?? null;
    }
  }

  const plan = planInboundRing({
    workspaceId,
    assignedUserIds,
    presence,
    ownerCell,
    aiEnabled: input.aiEnabled,
  });
  return { ...plan, workspaceId };
}
