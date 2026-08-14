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

/* ------------------------------------------------------------- opt-outs */

const STOP_WORDS = ["stop", "stopall", "unsubscribe", "cancel", "end", "quit", "revoke", "optout", "opt-out"];
const START_WORDS = ["start", "unstop", "yes", "optin", "opt-in"];

export type OptOutSignal = "stop" | "start" | null;

/** Carrier-standard keyword in an inbound message, if any. */
export function optOutSignal(body: string): OptOutSignal {
  const word = body.trim().toLowerCase().replace(/[^a-z-]/g, "");
  if (!word) return null;
  if (STOP_WORDS.includes(word)) return "stop";
  if (START_WORDS.includes(word)) return "start";
  return null;
}

/* --------------------------------------------------------- error copy */

const ERROR_COPY: Record<string, string> = {
  "30034": "This number isn't registered for US texting yet, so carriers blocked the message.",
  "21610": "This person replied STOP, so we can't text them until they reply START.",
  "21408": "Texting isn't enabled for that country on your Twilio account.",
  "30007": "The carrier filtered this message as spam. Try shorter, plainer wording.",
  "30003": "The phone was unreachable — switched off or out of coverage.",
  "30005": "That number doesn't exist or is no longer in service.",
  "30006": "That number is a landline and can't receive texts.",
  "21723": "Scheduled texts need an approved messaging service.",
  "21606": "That SixVox number can't send texts.",
  "12300": "The carrier rejected the message content type.",
  "30039": "The carrier rejected this message on a toll-free route.",
};

/** Human explanation for a Twilio message error code. */
export function describeMessageError(code: string | number | null | undefined): string | null {
  if (!code) return null;
  return ERROR_COPY[String(code)] ?? `Carrier error ${code}. The message was not delivered.`;
}

/** Best-effort friendly message from a raw Twilio API error body. */
export function friendlySendError(body: string): string | null {
  const match = /"code"\s*:\s*(\d+)/.exec(body);
  return match ? describeMessageError(match[1]) : null;
}
