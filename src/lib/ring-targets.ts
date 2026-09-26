/** How long a Voice SDK heartbeat still counts as "present" for an inbound ring. */
export const PRESENCE_WINDOW_MS = 45_000;

export type PresenceHit = {
  userId: string;
  workspaceId: string | null;
  identity: string;
  lastSeenAt: string;
};

export type InboundRingPlan = {
  /** Client identities to dial right now. Only present assignees of this workspace. */
  identities: string[];
  userIds: string[];
  /** Where the call goes when nobody in the app picks up. */
  fallback: "owner_cell" | "ai" | "voicemail";
  ownerCell: string | null;
};

/**
 * Inbound ring list for one called number.
 * Members of another workspace are ignored even if their user id appears in the
 * presence rows passed in.
 */
export function planInboundRing(input: {
  workspaceId: string | null;
  assignedUserIds: string[];
  presence: PresenceHit[];
  now?: number;
  windowMs?: number;
  ownerCell: string | null;
  aiEnabled: boolean;
}): InboundRingPlan {
  const now = input.now ?? Date.now();
  const windowMs = input.windowMs ?? PRESENCE_WINDOW_MS;
  const assigned = new Set(input.assignedUserIds);
  const seen = new Set<string>();
  const identities: string[] = [];
  const userIds: string[] = [];

  for (const row of input.presence) {
    if (!input.workspaceId || row.workspaceId !== input.workspaceId) continue;
    if (!assigned.has(row.userId)) continue;
    if (!row.identity) continue;
    const seenAt = Date.parse(row.lastSeenAt);
    if (Number.isNaN(seenAt) || now - seenAt > windowMs) continue;
    if (seen.has(row.userId)) continue;
    seen.add(row.userId);
    identities.push(row.identity);
    userIds.push(row.userId);
  }

  const ownerCell = input.ownerCell?.trim() ? input.ownerCell.trim() : null;
  const fallback = ownerCell ? "owner_cell" : input.aiEnabled ? "ai" : "voicemail";

  return { identities, userIds, fallback, ownerCell };
}
