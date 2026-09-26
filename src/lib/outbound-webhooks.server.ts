/**
 * Outbound webhook queue. Deliveries are signed, logged, and retried with backoff.
 * Callers enqueue; Twilio webhooks and the settings screen drain anything due.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  endpointReceivesEvent,
  isOutboundEventType,
  nextRetryAt,
  sampleEventData,
  signWebhookBody,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  type OutboundEventType,
} from "@/lib/outbound-webhooks";

export type PublishInput = {
  type: OutboundEventType;
  eventId: string;
  workspaceId: string | null;
  data: Record<string, unknown>;
};

type EndpointRow = {
  id: string;
  url: string;
  secret: string;
  events: string[] | null;
  enabled: boolean;
  workspace_id: string | null;
};

type DeliveryRow = {
  id: string;
  endpoint_id: string;
  event_type: string;
  event_id: string;
  body: string;
  attempt_count: number;
  status: string;
};

const INLINE_TIMEOUT_MS = 4000;

export function webhookEnvelope(input: PublishInput, createdAt: string) {
  return {
    id: input.eventId,
    type: input.type,
    created_at: createdAt,
    workspace_id: input.workspaceId,
    data: input.data,
  };
}

export async function publishOutboundEvent(
  admin: SupabaseClient,
  input: PublishInput,
): Promise<void> {
  const { data, error } = await admin
    .from("outbound_webhook_endpoints")
    .select("id, url, secret, events, enabled, workspace_id")
    .eq("enabled", true);
  if (error || !data) {
    if (error) console.error("webhook endpoint lookup failed", error.message);
    return;
  }

  const createdAt = new Date().toISOString();
  const body = JSON.stringify(webhookEnvelope(input, createdAt));
  for (const endpoint of data as EndpointRow[]) {
    const events = endpoint.events ?? [];
    if (!events.includes(input.type)) continue;
    if (!endpointReceivesEvent(endpoint.workspace_id, input.workspaceId)) continue;
    const { error: insertError } = await admin.from("outbound_webhook_deliveries").insert({
      endpoint_id: endpoint.id,
      workspace_id: input.workspaceId,
      event_type: input.type,
      event_id: input.eventId,
      payload: JSON.parse(body) as Record<string, unknown>,
      body,
      status: "pending",
      attempt_count: 0,
      next_attempt_at: createdAt,
    });
    if (insertError && !/duplicate|unique/i.test(insertError.message)) {
      console.error("webhook enqueue failed", insertError.message);
    }
  }
}

function shouldRetry(status: number | null): boolean {
  if (status === null) return true;
  if (status === 408 || status === 429) return true;
  return status >= 500;
}

export async function attemptDelivery(
  admin: SupabaseClient,
  deliveryId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<"delivered" | "pending" | "dead" | "missing"> {
  const { data: delivery } = await admin
    .from("outbound_webhook_deliveries")
    .select("id, endpoint_id, event_type, event_id, body, attempt_count, status")
    .eq("id", deliveryId)
    .maybeSingle();
  if (!delivery) return "missing";
  const row = delivery as DeliveryRow;
  if (row.status === "delivered") return "delivered";

  const { data: endpoint } = await admin
    .from("outbound_webhook_endpoints")
    .select("id, url, secret, enabled")
    .eq("id", row.endpoint_id)
    .maybeSingle();
  if (!endpoint || endpoint.enabled === false) {
    await admin
      .from("outbound_webhook_deliveries")
      .update({ status: "dead", last_error: "Endpoint disabled or missing", next_attempt_at: null })
      .eq("id", row.id);
    return "dead";
  }

  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await signWebhookBody(endpoint.secret as string, timestamp, row.body);
  let statusCode: number | null = null;
  let errorText: string | null = null;
  try {
    const response = await fetchImpl(endpoint.url as string, {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(INLINE_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "SixVox-Webhooks/1",
        [TIMESTAMP_HEADER]: timestamp,
        [SIGNATURE_HEADER]: signature,
      },
      body: row.body,
    });
    statusCode = response.status;
    if (response.status < 200 || response.status >= 300) {
      errorText = `HTTP ${response.status}`;
    }
  } catch (error) {
    errorText = error instanceof Error ? error.message : "Delivery failed";
  }

  const attemptCount = row.attempt_count + 1;
  const ok = statusCode !== null && statusCode >= 200 && statusCode < 300;
  if (ok) {
    await admin
      .from("outbound_webhook_deliveries")
      .update({
        status: "delivered",
        attempt_count: attemptCount,
        last_status_code: statusCode,
        last_error: null,
        delivered_at: new Date().toISOString(),
        next_attempt_at: null,
      })
      .eq("id", row.id);
    return "delivered";
  }

  const retry = shouldRetry(statusCode);
  const next = retry ? nextRetryAt(attemptCount, new Date()) : null;
  await admin
    .from("outbound_webhook_deliveries")
    .update({
      status: next ? "pending" : "dead",
      attempt_count: attemptCount,
      last_status_code: statusCode,
      last_error: errorText,
      next_attempt_at: next ? next.toISOString() : null,
    })
    .eq("id", row.id);
  return next ? "pending" : "dead";
}

export async function drainDueDeliveries(
  admin: SupabaseClient,
  limit = 5,
  fetchImpl: typeof fetch = fetch,
): Promise<number> {
  const now = new Date().toISOString();
  const { data } = await admin
    .from("outbound_webhook_deliveries")
    .select("id")
    .eq("status", "pending")
    .lte("next_attempt_at", now)
    .order("next_attempt_at", { ascending: true })
    .limit(limit);
  let done = 0;
  for (const row of data ?? []) {
    await attemptDelivery(admin, row.id as string, fetchImpl);
    done += 1;
  }
  return done;
}

export async function redeliver(admin: SupabaseClient, deliveryId: string): Promise<void> {
  const { error } = await admin
    .from("outbound_webhook_deliveries")
    .update({ status: "pending", next_attempt_at: new Date().toISOString(), last_error: null })
    .eq("id", deliveryId);
  if (error) throw error;
  await attemptDelivery(admin, deliveryId);
}

export async function sendTestEvent(
  admin: SupabaseClient,
  endpointId: string,
  type: OutboundEventType,
): Promise<void> {
  const { data: endpoint, error } = await admin
    .from("outbound_webhook_endpoints")
    .select("id, workspace_id, events")
    .eq("id", endpointId)
    .maybeSingle();
  if (error) throw error;
  if (!endpoint) throw new Error("Webhook endpoint not found.");
  const eventId = `test.${type}.${Date.now()}`;
  const createdAt = new Date().toISOString();
  const input: PublishInput = {
    type,
    eventId,
    workspaceId: (endpoint.workspace_id as string | null) ?? null,
    data: sampleEventData(type),
  };
  const body = JSON.stringify(webhookEnvelope(input, createdAt));
  const { data: inserted, error: insertError } = await admin
    .from("outbound_webhook_deliveries")
    .insert({
      endpoint_id: endpointId,
      workspace_id: input.workspaceId,
      event_type: type,
      event_id: eventId,
      payload: JSON.parse(body) as Record<string, unknown>,
      body,
      status: "pending",
      attempt_count: 0,
      next_attempt_at: createdAt,
    })
    .select("id")
    .single();
  if (insertError) throw insertError;
  await attemptDelivery(admin, inserted.id as string);
}

export function assertEventList(events: string[]): OutboundEventType[] {
  const unique = [...new Set(events)];
  if (unique.length === 0) throw new Error("Pick at least one event.");
  const typed: OutboundEventType[] = [];
  for (const event of unique) {
    if (!isOutboundEventType(event)) throw new Error(`Unknown event ${event}.`);
    typed.push(event);
  }
  return typed;
}
