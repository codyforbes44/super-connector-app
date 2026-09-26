import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "@/lib/app.server";
import {
  assertPublicWebhookUrl,
  eventLabel,
  isOutboundEventType,
  OUTBOUND_EVENT_TYPES,
  type OutboundEventType,
} from "@/lib/outbound-webhooks";
import { assertEventList, redeliver, sendTestEvent } from "@/lib/outbound-webhooks.server";

export type WebhookEndpointView = {
  id: string;
  url: string;
  secret: string;
  enabled: boolean;
  events: OutboundEventType[];
  description: string | null;
  workspaceId: string | null;
  createdAt: string;
};

export type WebhookDeliveryView = {
  id: string;
  endpointId: string;
  eventType: string;
  eventLabel: string;
  status: string;
  attemptCount: number;
  lastStatusCode: number | null;
  lastError: string | null;
  nextAttemptAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
};

function newSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function asEndpoint(row: Record<string, unknown>): WebhookEndpointView {
  const events = ((row["events"] as string[] | null) ?? []).filter(isOutboundEventType);
  return {
    id: row["id"] as string,
    url: row["url"] as string,
    secret: row["secret"] as string,
    enabled: Boolean(row["enabled"]),
    events,
    description: (row["description"] as string | null) ?? null,
    workspaceId: (row["workspace_id"] as string | null) ?? null,
    createdAt: row["created_at"] as string,
  };
}

export async function listWebhookSettings(supabase: SupabaseClient, userId: string) {
  await requireAdmin(supabase, userId);
  const [{ data: endpoints, error: endpointError }, { data: deliveries, error: deliveryError }] =
    await Promise.all([
      supabaseAdmin
        .from("outbound_webhook_endpoints")
        .select("*")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("outbound_webhook_deliveries")
        .select(
          "id, endpoint_id, event_type, status, attempt_count, last_status_code, last_error, next_attempt_at, delivered_at, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(40),
    ]);
  if (endpointError) throw endpointError;
  if (deliveryError) throw deliveryError;
  return {
    eventTypes: OUTBOUND_EVENT_TYPES.map((type) => ({ type, label: eventLabel(type) })),
    endpoints: (endpoints ?? []).map((row) => asEndpoint(row as Record<string, unknown>)),
    deliveries: (deliveries ?? []).map((row) => {
      const type = row.event_type as string;
      return {
        id: row.id as string,
        endpointId: row.endpoint_id as string,
        eventType: type,
        eventLabel: isOutboundEventType(type) ? eventLabel(type) : type,
        status: row.status as string,
        attemptCount: row.attempt_count as number,
        lastStatusCode: (row.last_status_code as number | null) ?? null,
        lastError: (row.last_error as string | null) ?? null,
        nextAttemptAt: (row.next_attempt_at as string | null) ?? null,
        deliveredAt: (row.delivered_at as string | null) ?? null,
        createdAt: row.created_at as string,
      } satisfies WebhookDeliveryView;
    }),
  };
}

export async function createWebhookEndpoint(
  supabase: SupabaseClient,
  userId: string,
  input: { url: string; events: string[]; description?: string | null },
) {
  await requireAdmin(supabase, userId);
  const url = assertPublicWebhookUrl(input.url);
  const events = assertEventList(input.events);
  const secret = newSecret();
  const { data, error } = await supabaseAdmin
    .from("outbound_webhook_endpoints")
    .insert({
      url: url.toString(),
      secret,
      events,
      description: input.description?.trim().slice(0, 120) || null,
      enabled: true,
    })
    .select("*")
    .single();
  if (error) throw error;
  return asEndpoint(data as Record<string, unknown>);
}

export async function updateWebhookEndpoint(
  supabase: SupabaseClient,
  userId: string,
  input: {
    id: string;
    url?: string;
    events?: string[];
    enabled?: boolean;
    description?: string | null;
  },
) {
  await requireAdmin(supabase, userId);
  const patch: {
    url?: string;
    events?: ReturnType<typeof assertEventList>;
    enabled?: boolean;
    description?: string | null;
  } = {};
  if (input.url !== undefined) patch.url = assertPublicWebhookUrl(input.url).toString();
  if (input.events !== undefined) patch.events = assertEventList(input.events);
  if (input.enabled !== undefined) patch.enabled = input.enabled;
  if (input.description !== undefined)
    patch.description = input.description?.trim().slice(0, 120) || null;
  const { error } = await supabaseAdmin
    .from("outbound_webhook_endpoints")
    .update(patch)
    .eq("id", input.id);
  if (error) throw error;
  return { ok: true as const };
}

export async function rotateWebhookSecret(supabase: SupabaseClient, userId: string, id: string) {
  await requireAdmin(supabase, userId);
  const secret = newSecret();
  const { error } = await supabaseAdmin
    .from("outbound_webhook_endpoints")
    .update({ secret })
    .eq("id", id);
  if (error) throw error;
  return { secret };
}

export async function deleteWebhookEndpoint(supabase: SupabaseClient, userId: string, id: string) {
  await requireAdmin(supabase, userId);
  const { error } = await supabaseAdmin.from("outbound_webhook_endpoints").delete().eq("id", id);
  if (error) throw error;
  return { ok: true as const };
}

export async function resendWebhookDelivery(
  supabase: SupabaseClient,
  userId: string,
  deliveryId: string,
) {
  await requireAdmin(supabase, userId);
  await redeliver(supabaseAdmin, deliveryId);
  return { ok: true as const };
}

export async function sendWebhookTest(
  supabase: SupabaseClient,
  userId: string,
  input: { endpointId: string; type: OutboundEventType },
) {
  await requireAdmin(supabase, userId);
  await sendTestEvent(supabaseAdmin, input.endpointId, input.type);
  return { ok: true as const };
}
