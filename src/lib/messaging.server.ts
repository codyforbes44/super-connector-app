/**
 * US A2P (10DLC) texting readiness.
 *
 * A US long code can only deliver SMS when it sits in a Messaging Service whose
 * campaign is registered and verified. This module keeps that state on
 * `phone_numbers` so every send path can check it before spending a message,
 * and turns Twilio's numeric failures into copy a human can act on.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { twilioRequest } from "./twilio.server";
import { webhookUrl } from "./app.server";

type SB = SupabaseClient;

export type NumberMessagingState = {
  phoneNumber: string;
  messagingServiceSid: string | null;
  campaignId: string | null;
  campaignStatus: string | null;
  ready: boolean;
};

/** Campaign states Twilio treats as cleared to send. */
export function campaignApproved(status: string | null | undefined): boolean {
  const value = (status ?? "").toUpperCase();
  return value === "VERIFIED" || value === "APPROVED" || value === "REGISTERED";
}

type ServiceRow = { sid: string; friendly_name?: string };

type ServiceConfig = ServiceRow & {
  inbound_request_url?: string | null;
  use_inbound_webhook_on_number?: boolean | null;
};

/**
 * A number inside a Messaging Service takes its inbound webhook from the
 * service, not from the number. If that URL drifts (another app, a console
 * edit), inbound texts silently 404 elsewhere and never reach the inbox — so
 * repoint any service that carries one of our numbers back at our endpoint.
 */
export async function ensureServiceInbound(serviceSid: string): Promise<boolean> {
  const target = webhookUrl("sms");
  try {
    const service = await twilioRequest<ServiceConfig>({
      host: "messaging",
      path: `/v1/Services/${serviceSid}`,
    });
    const drifted =
      service.use_inbound_webhook_on_number === true ||
      (service.inbound_request_url ?? "") !== target;
    if (!drifted) return false;
    await twilioRequest({
      host: "messaging",
      method: "POST",
      path: `/v1/Services/${serviceSid}`,
      params: {
        InboundRequestUrl: target,
        InboundMethod: "POST",
        FallbackUrl: target,
        FallbackMethod: "POST",
        StatusCallback: webhookUrl("status"),
        UseInboundWebhookOnNumber: false,
      },
    });
    return true;
  } catch (error) {
    console.error(`failed to repair inbound webhook for ${serviceSid}`, error);
    return false;
  }
}

/**
 * Walk every Messaging Service, map its sender pool, and record the campaign
 * status against each local number. Returns the resulting state per number.
 */
export async function syncMessagingReadiness(admin: SB): Promise<NumberMessagingState[]> {
  const services = await twilioRequest<{ services?: ServiceRow[] }>({
    host: "messaging",
    path: "/v1/Services",
    params: { PageSize: 50 },
  });

  // phone number -> best known state (an approved campaign always wins)
  const byNumber = new Map<string, { sid: string; campaignId: string | null; status: string | null }>();

  for (const service of services.services ?? []) {
    const [pool, compliance] = await Promise.all([
      twilioRequest<{ phone_numbers?: Array<{ phone_number: string }> }>({
        host: "messaging",
        path: `/v1/Services/${service.sid}/PhoneNumbers`,
        params: { PageSize: 100 },
      }).catch(() => ({ phone_numbers: [] })),
      twilioRequest<{ compliance?: Array<{ campaign_id?: string; campaign_status?: string }> }>({
        host: "messaging",
        path: `/v1/Services/${service.sid}/Compliance/Usa2p`,
        params: { PageSize: 5 },
      }).catch(() => null),
    ]);

    const campaign = compliance?.compliance?.[0] ?? null;
    const status = campaign?.campaign_status ?? null;

    for (const entry of pool.phone_numbers ?? []) {
      const current = byNumber.get(entry.phone_number);
      if (current && campaignApproved(current.status) && !campaignApproved(status)) continue;
      byNumber.set(entry.phone_number, {
        sid: service.sid,
        campaignId: campaign?.campaign_id ?? null,
        status,
      });
    }

    // Any service holding at least one of our numbers must deliver inbound here.
    if ((pool.phone_numbers ?? []).length) await ensureServiceInbound(service.sid);
  }

  const { data: rows } = await admin.from("phone_numbers").select("phone_number");
  const checkedAt = new Date().toISOString();
  const states: NumberMessagingState[] = [];

  for (const row of rows ?? []) {
    const phoneNumber = row["phone_number"] as string;
    const hit = byNumber.get(phoneNumber) ?? null;
    await admin
      .from("phone_numbers")
      .update({
        messaging_service_sid: hit?.sid ?? null,
        campaign_id: hit?.campaignId ?? null,
        campaign_status: hit?.status ?? null,
        messaging_checked_at: checkedAt,
      })
      .eq("phone_number", phoneNumber);
    states.push({
      phoneNumber,
      messagingServiceSid: hit?.sid ?? null,
      campaignId: hit?.campaignId ?? null,
      campaignStatus: hit?.status ?? null,
      ready: Boolean(hit?.sid) && campaignApproved(hit?.status),
    });
  }

  return states;
}

const STALE_MS = 6 * 60 * 60 * 1000;

/**
 * Messaging state for one number, refreshing from Twilio when the cached row is
 * missing or stale. Never throws — an API hiccup degrades to the cached value.
 */
export async function messagingStateFor(admin: SB, phoneNumber: string): Promise<NumberMessagingState> {
  const read = async (): Promise<NumberMessagingState | null> => {
    const { data } = await admin
      .from("phone_numbers")
      .select("phone_number, messaging_service_sid, campaign_id, campaign_status, messaging_checked_at")
      .eq("phone_number", phoneNumber)
      .maybeSingle();
    if (!data) return null;
    const checked = data["messaging_checked_at"] as string | null;
    const fresh = checked ? Date.now() - new Date(checked).getTime() < STALE_MS : false;
    if (!fresh) return null;
    return {
      phoneNumber,
      messagingServiceSid: (data["messaging_service_sid"] as string | null) ?? null,
      campaignId: (data["campaign_id"] as string | null) ?? null,
      campaignStatus: (data["campaign_status"] as string | null) ?? null,
      ready:
        Boolean(data["messaging_service_sid"]) &&
        campaignApproved(data["campaign_status"] as string | null),
    };
  };

  const cached = await read();
  if (cached) return cached;

  try {
    const states = await syncMessagingReadiness(admin);
    const hit = states.find((state) => state.phoneNumber === phoneNumber);
    if (hit) return hit;
  } catch (error) {
    console.error("messaging readiness sync failed", error);
  }

  const { data } = await admin
    .from("phone_numbers")
    .select("messaging_service_sid, campaign_id, campaign_status")
    .eq("phone_number", phoneNumber)
    .maybeSingle();
  return {
    phoneNumber,
    messagingServiceSid: (data?.["messaging_service_sid"] as string | null) ?? null,
    campaignId: (data?.["campaign_id"] as string | null) ?? null,
    campaignStatus: (data?.["campaign_status"] as string | null) ?? null,
    ready:
      Boolean(data?.["messaging_service_sid"]) &&
      campaignApproved(data?.["campaign_status"] as string | null),
  };
}

export {
  optOutSignal,
  describeMessageError,
  friendlySendError,
  type OptOutSignal,
} from "./message-status";
