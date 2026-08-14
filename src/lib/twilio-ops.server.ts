import type { SupabaseClient } from "@supabase/supabase-js";

import {
  allowedNumbers,
  audit,
  getRole,
  isAdminRole,
  isOwnerRole,
  requireAdmin,
  requireOwner,
  upsertConversation,
  webhookUrl,
} from "./app.server";
import {
  credentialHealth,
  hasDirectCredentials,
  normalizePhone,
  stripChannel,
  twilioRequest,
  type TwilioHost,
} from "./twilio.server";

type SB = SupabaseClient;

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
const asJson = (value: unknown) => value as Json;

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SB;
}

/* ------------------------------------------------------------------ shell */

export async function bootstrap(supabase: SB, userId: string) {
  const [{ data: profile }, role] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    getRole(supabase, userId),
  ]);
  const { data: numbers } = await supabase
    .from("phone_numbers")
    .select("*")
    .order("phone_number");
  return {
    profile,
    role,
    isAdmin: isAdminRole(role),
    isOwner: isOwnerRole(role),
    numbers: numbers ?? [],
    directCredentials: hasDirectCredentials(),
    smsWebhook: webhookUrl("sms"),
    voiceWebhook: webhookUrl("voice"),
    statusWebhook: webhookUrl("status"),
  };
}

/* ---------------------------------------------------------------- numbers */

type TwilioNumber = {
  sid: string;
  phone_number: string;
  friendly_name: string;
  capabilities: Record<string, boolean>;
  sms_url?: string | null;
  voice_url?: string | null;
  sms_application_sid?: string | null;
};

/** True when inbound SMS lands on our own webhook with no app SID shadowing it. */
function smsRoutedHere(n: TwilioNumber): boolean {
  if (n.sms_application_sid) return false;
  return Boolean(n.sms_url && n.sms_url.includes("/api/public/twilio/sms"));
}

export async function syncNumbers(supabase: SB, userId: string) {
  await requireAdmin(supabase, userId);
  const admin = await adminClient();
  // Walk every page so the local list always mirrors the live Twilio account.
  const list: TwilioNumber[] = [];
  for (let page = 0; page < 20; page += 1) {
    const res = await twilioRequest<{ incoming_phone_numbers: TwilioNumber[] }>({
      path: "/IncomingPhoneNumbers.json",
      params: { PageSize: 100, Page: page },
    });
    const chunk = res.incoming_phone_numbers ?? [];
    list.push(...chunk);
    if (chunk.length < 100) break;
  }
  for (const n of list) {
    await admin.from("phone_numbers").upsert(
      {
        sid: n.sid,
        phone_number: n.phone_number,
        friendly_name: n.friendly_name,
        capabilities: n.capabilities ?? {},
        sms_url: n.sms_url ?? null,
        voice_url: n.voice_url ?? null,
        webhook_wired: smsRoutedHere(n),
      },
      { onConflict: "sid" },
    );
  }
  // Drop anything released in the Twilio console (including the empty case).
  const sids = list.map((n) => n.sid);
  const prune = admin.from("phone_numbers").delete();
  const { data: removed } = sids.length
    ? await prune.not("sid", "in", `(${sids.join(",")})`).select("phone_number")
    : await prune.not("sid", "is", null).select("phone_number");
  const removedCount = removed?.length ?? 0;
  await audit(admin, userId, "numbers.sync", { count: list.length, removed: removedCount });
  const { data } = await supabase.from("phone_numbers").select("*").order("phone_number");
  return { numbers: data ?? [], synced: list.length, removed: removedCount };
}

export async function assignNumber(
  supabase: SB,
  userId: string,
  data: { sid: string; assignedTo: string | null },
) {
  await requireAdmin(supabase, userId);
  const admin = await adminClient();
  const { error } = await admin
    .from("phone_numbers")
    .update({ assigned_to: data.assignedTo })
    .eq("sid", data.sid);
  if (error) throw error;
  await audit(admin, userId, "numbers.assign", data as Record<string, unknown>);
  return { ok: true };
}

export async function updateNumberSettings(
  supabase: SB,
  userId: string,
  data: {
    sid: string;
    friendlyName?: string;
    forwardTo?: string | null;
    voicemailGreeting?: string | null;
    channelWhatsapp?: boolean;
  },
) {
  await requireAdmin(supabase, userId);
  const admin = await adminClient();
  if (data.friendlyName) {
    await twilioRequest({
      method: "POST",
      path: `/IncomingPhoneNumbers/${data.sid}.json`,
      params: { FriendlyName: data.friendlyName },
    });
  }
  const patch: Record<string, unknown> = {};
  if (data.friendlyName !== undefined) patch["friendly_name"] = data.friendlyName;
  if (data.forwardTo !== undefined)
    patch["forward_to"] = data.forwardTo ? normalizePhone(data.forwardTo) : null;
  if (data.voicemailGreeting !== undefined) patch["voicemail_greeting"] = data.voicemailGreeting;
  if (data.channelWhatsapp !== undefined) patch["channel_whatsapp"] = data.channelWhatsapp;
  await admin.from("phone_numbers").update(patch).eq("sid", data.sid);
  return { ok: true };
}

/* ------------------------------------------------------- caller ID / default */

type OutgoingCallerId = {
  sid: string;
  phone_number: string;
  friendly_name: string | null;
  date_created?: string;
};

export type CallerIdStatus = "verified" | "pending" | "failed";

export type CallerIdEntry = {
  sid: string;
  phoneNumber: string;
  friendlyName: string | null;
  dateCreated: string | null;
  status: CallerIdStatus;
  validationCode: string | null;
  error: string | null;
};

/** Pending verification attempts time out after this window. */
const VERIFY_WINDOW_MS = 12 * 60 * 1000;

/**
 * Caller IDs with live status. Twilio only lists numbers that finished
 * verification, so pending/failed attempts are tracked locally and reconciled
 * against the Twilio list on every read.
 */
export async function listCallerIds(supabase: SB, userId: string): Promise<CallerIdEntry[]> {
  await allowedNumbers(supabase, userId);
  const res = await twilioRequest<{ outgoing_caller_ids: OutgoingCallerId[] }>({
    path: "/OutgoingCallerIds.json",
    params: { PageSize: 100 },
  });
  const verified = (res.outgoing_caller_ids ?? []).map((item) => ({
    sid: item.sid,
    phoneNumber: normalizePhone(item.phone_number),
    friendlyName: item.friendly_name,
    dateCreated: item.date_created ?? null,
    status: "verified" as CallerIdStatus,
    validationCode: null,
    error: null,
  }));

  const admin = await adminClient();
  const { data: attempts } = await admin
    .from("caller_id_verifications")
    .select("id, phone_number, friendly_name, status, validation_code, error, created_at")
    .order("created_at", { ascending: false });

  const verifiedSet = new Set(verified.map((v) => v.phoneNumber));
  const extras: CallerIdEntry[] = [];

  for (const row of attempts ?? []) {
    const phoneNumber = normalizePhone(row.phone_number as string);
    if (verifiedSet.has(phoneNumber)) {
      if (row.status !== "verified") {
        await admin
          .from("caller_id_verifications")
          .update({ status: "verified", validation_code: null, error: null })
          .eq("id", row.id);
      }
      continue;
    }
    let status = row.status as CallerIdStatus;
    let error = (row.error as string | null) ?? null;
    const age = Date.now() - new Date(row.created_at as string).getTime();
    if (status === "pending" && age > VERIFY_WINDOW_MS) {
      status = "failed";
      error = "Verification timed out — the code was never entered.";
      await admin.from("caller_id_verifications").update({ status, error }).eq("id", row.id);
    }
    extras.push({
      sid: `local:${row.id}`,
      phoneNumber,
      friendlyName: (row.friendly_name as string | null) ?? null,
      dateCreated: row.created_at as string,
      status,
      validationCode: status === "pending" ? ((row.validation_code as string | null) ?? null) : null,
      error,
    });
  }

  return [...extras, ...verified];
}

/**
 * Kicks off caller ID verification: Twilio calls the number and reads out the
 * returned six-digit code, which the caller types on the keypad.
 */
export async function requestCallerIdVerification(
  supabase: SB,
  userId: string,
  data: { phoneNumber: string; friendlyName?: string },
) {
  await requireAdmin(supabase, userId);
  const phoneNumber = normalizePhone(data.phoneNumber);
  const res = await twilioRequest<{ validation_code: string; phone_number: string }>({
    method: "POST",
    path: "/OutgoingCallerIds.json",
    params: {
      PhoneNumber: phoneNumber,
      FriendlyName: data.friendlyName || phoneNumber,
    },
  });
  const admin = await adminClient();
  await admin.from("caller_id_verifications").upsert(
    {
      phone_number: phoneNumber,
      friendly_name: data.friendlyName || null,
      status: "pending",
      validation_code: res.validation_code,
      error: null,
      requested_by: userId,
      created_at: new Date().toISOString(),
    },
    { onConflict: "phone_number" },
  );
  await audit(admin, userId, "callerid.verify_request", { phoneNumber });
  return { validationCode: res.validation_code, phoneNumber: res.phone_number ?? phoneNumber };
}

export async function deleteCallerId(
  supabase: SB,
  userId: string,
  data: { sid: string; phoneNumber?: string },
) {
  await requireAdmin(supabase, userId);
  const admin = await adminClient();
  if (data.sid.startsWith("local:")) {
    await admin.from("caller_id_verifications").delete().eq("id", data.sid.slice(6));
  } else {
    await twilioRequest({ method: "DELETE", path: `/OutgoingCallerIds/${data.sid}.json` });
  }
  if (data.phoneNumber) {
    const value = normalizePhone(data.phoneNumber);
    await admin.from("caller_id_verifications").delete().eq("phone_number", value);
    await admin.from("caller_id_routes").delete().eq("caller_id", value);
    await admin.from("contacts").update({ outbound_caller_id: null }).eq("outbound_caller_id", value);
    await admin
      .from("phone_numbers")
      .update({ outbound_caller_id: null })
      .eq("outbound_caller_id", value);
  }
  await audit(admin, userId, "callerid.delete", { sid: data.sid });
  return { ok: true };
}

/** Numbers that are safe to present as a caller ID (verified on the account). */
async function verifiedCallerIdSet(supabase: SB, userId: string): Promise<Set<string>> {
  const list = await listCallerIds(supabase, userId);
  return new Set(
    list.filter((item) => item.status === "verified").map((item) => normalizePhone(item.phoneNumber)),
  );
}

/* ------------------------------------------------- caller ID routing rules */

/** Rules that pick a caller ID by destination: an exact number or a prefix. */
export async function listCallerIdRoutes(supabase: SB, userId: string) {
  await allowedNumbers(supabase, userId);
  const { data, error } = await supabase
    .from("caller_id_routes")
    .select("id, pattern, caller_id, label, created_at")
    .order("pattern", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    pattern: row.pattern as string,
    callerId: row.caller_id as string,
    label: (row.label as string | null) ?? null,
  }));
}

export async function upsertCallerIdRoute(
  supabase: SB,
  userId: string,
  data: { id?: string; pattern: string; callerId: string; label?: string | null },
) {
  await requireAdmin(supabase, userId);
  const pattern = data.pattern.trim().replace(/[^\d+*]/g, "").replace(/\*+$/, "");
  if (pattern.length < 2) throw new Error("Enter a full number or at least a country/area prefix.");
  const callerId = normalizePhone(data.callerId);
  const verified = await verifiedCallerIdSet(supabase, userId);
  if (!verified.has(callerId)) throw new Error("Pick a verified caller ID.");
  const admin = await adminClient();
  const { error } = await admin.from("caller_id_routes").upsert(
    {
      ...(data.id ? { id: data.id } : {}),
      pattern,
      caller_id: callerId,
      label: data.label?.trim() || null,
      created_by: userId,
    },
    { onConflict: "pattern" },
  );
  if (error) throw new Error(error.message);
  await audit(admin, userId, "callerid.route_save", { pattern, callerId });
  return { ok: true };
}

export async function deleteCallerIdRoute(supabase: SB, userId: string, data: { id: string }) {
  await requireAdmin(supabase, userId);
  const admin = await adminClient();
  await admin.from("caller_id_routes").delete().eq("id", data.id);
  await audit(admin, userId, "callerid.route_delete", { id: data.id });
  return { ok: true };
}

/** Per-contact caller ID override. Pass null to fall back to routes. */
export async function setContactCallerId(
  supabase: SB,
  userId: string,
  data: { phoneNumber: string; callerId: string | null },
) {
  await allowedNumbers(supabase, userId);
  const phoneNumber = normalizePhone(data.phoneNumber);
  let value: string | null = null;
  if (data.callerId) {
    value = normalizePhone(data.callerId);
    const verified = await verifiedCallerIdSet(supabase, userId);
    if (!verified.has(value)) throw new Error("Pick a verified caller ID.");
  }
  const admin = await adminClient();
  const { error } = await admin
    .from("contacts")
    .update({ outbound_caller_id: value })
    .eq("phone_number", phoneNumber);
  if (error) throw new Error(error.message);
  await audit(admin, userId, "callerid.contact_override", { phoneNumber, callerId: value });
  return { ok: true };
}

/** Per-number outbound caller ID. Pass null to present the SixVox number. */
export async function setOutboundCallerId(
  supabase: SB,
  userId: string,
  data: { sid: string; callerId: string | null },
) {
  await requireAdmin(supabase, userId);
  let value: string | null = null;
  if (data.callerId) {
    value = normalizePhone(data.callerId);
    const verified = await verifiedCallerIdSet(supabase, userId);
    if (!verified.has(value)) {
      throw new Error("That number isn't a verified caller ID yet. Verify it first.");
    }
  }
  const admin = await adminClient();
  await admin.from("phone_numbers").update({ outbound_caller_id: value }).eq("sid", data.sid);
  await audit(admin, userId, "numbers.caller_id", { sid: data.sid, callerId: value });
  return { ok: true };
}

/** The number this user's dialer and composer start from. */
export async function setDefaultNumber(
  supabase: SB,
  userId: string,
  data: { phoneNumber: string | null },
) {
  let value: string | null = null;
  if (data.phoneNumber) {
    value = normalizePhone(data.phoneNumber);
    const { numbers } = await allowedNumbers(supabase, userId);
    if (!numbers.includes(value)) throw new Error("You are not assigned to that number.");
  }
  const { error } = await supabase
    .from("profiles")
    .update({ default_number: value })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/**
 * Which number the recipient sees for calls placed from `appNumber`.
 * Precedence: per-contact override → exact route → longest matching prefix
 * route → per-number caller ID → the SixVox number itself.
 */
export async function resolveOutboundCallerId(
  client: SB,
  appNumber: string,
  to?: string | null,
): Promise<string> {
  const target = to ? normalizePhone(to) : null;

  if (target) {
    const { data: contact } = await client
      .from("contacts")
      .select("outbound_caller_id")
      .eq("phone_number", target)
      .maybeSingle();
    const override = (contact?.outbound_caller_id as string | null) ?? null;
    if (override) return normalizePhone(override);

    const { data: routes } = await client.from("caller_id_routes").select("pattern, caller_id");
    const match = (routes ?? [])
      .filter((row) => target.startsWith(row.pattern as string))
      .sort((a, b) => (b.pattern as string).length - (a.pattern as string).length)[0];
    if (match) return normalizePhone(match.caller_id as string);
  }

  const { data } = await client
    .from("phone_numbers")
    .select("outbound_caller_id")
    .eq("phone_number", appNumber)
    .maybeSingle();
  const value = (data?.outbound_caller_id as string | null) ?? null;
  return value ? normalizePhone(value) : appNumber;
}

export async function wireNumber(
  supabase: SB,
  userId: string,
  data: { sid: string; applicationSid?: string | null },
) {
  await requireAdmin(supabase, userId);
  const admin = await adminClient();
  const appSid = data.applicationSid ?? (await defaultTwimlAppSid(admin));
  // Messaging always points straight at our own SMS webhook. An SmsApplicationSid
  // silently overrides SmsUrl on the number, so it must stay cleared — otherwise
  // inbound texts follow whatever URL that TwiML App happens to hold.
  const smsParams = {
    SmsApplicationSid: "",
    SmsUrl: webhookUrl("sms"),
    SmsMethod: "POST",
    SmsFallbackUrl: webhookUrl("sms"),
    SmsFallbackMethod: "POST",
    StatusCallback: webhookUrl("status"),
    StatusCallbackMethod: "POST",
  };
  const voiceParams = appSid
    ? {
        VoiceApplicationSid: appSid,
        VoiceFallbackUrl: webhookUrl("voice-fallback"),
        VoiceFallbackMethod: "POST",
      }
    : {
        VoiceApplicationSid: "",
        VoiceUrl: webhookUrl("voice"),
        VoiceMethod: "POST",
        VoiceFallbackUrl: webhookUrl("voice-fallback"),
        VoiceFallbackMethod: "POST",
      };
  await twilioRequest({
    method: "POST",
    path: `/IncomingPhoneNumbers/${data.sid}.json`,
    params: { ...smsParams, ...voiceParams },
  });
  await admin
    .from("phone_numbers")
    .update({
      webhook_wired: true,
      sms_url: webhookUrl("sms"),
      voice_url: appSid ? webhookUrl("app-voice") : webhookUrl("voice"),
    })
    .eq("sid", data.sid);
  await audit(admin, userId, "numbers.wire", { sid: data.sid, applicationSid: appSid ?? null });
  return { ok: true, applicationSid: appSid ?? null };
}

export async function searchAvailableNumbers(
  supabase: SB,
  userId: string,
  data: { country: string; areaCode?: string; contains?: string; type: string },
) {
  await requireAdmin(supabase, userId);
  const res = await twilioRequest<{ available_phone_numbers: unknown[] }>({
    path: `/AvailablePhoneNumbers/${data.country}/${data.type}.json`,
    params: {
      AreaCode: data.areaCode,
      Contains: data.contains,
      SmsEnabled: true,
      VoiceEnabled: true,
      PageSize: 20,
    },
  });
  return asJson(res.available_phone_numbers ?? []) as Json[];
}

export async function purchaseNumber(
  supabase: SB,
  userId: string,
  data: { phoneNumber: string },
) {
  await requireOwner(supabase, userId);
  const admin = await adminClient();
  const bought = await twilioRequest<TwilioNumber>({
    method: "POST",
    path: "/IncomingPhoneNumbers.json",
    params: {
      PhoneNumber: data.phoneNumber,
      SmsUrl: webhookUrl("sms"),
      SmsMethod: "POST",
      SmsFallbackUrl: webhookUrl("sms"),
      SmsFallbackMethod: "POST",
      VoiceUrl: webhookUrl("voice"),
      VoiceMethod: "POST",
      VoiceFallbackUrl: webhookUrl("voice-fallback"),
      VoiceFallbackMethod: "POST",
      StatusCallback: webhookUrl("status"),
      StatusCallbackMethod: "POST",
    },
  });
  await admin.from("phone_numbers").upsert(
    {
      sid: bought.sid,
      phone_number: bought.phone_number,
      friendly_name: bought.friendly_name,
      capabilities: bought.capabilities ?? {},
      sms_url: webhookUrl("sms"),
      voice_url: webhookUrl("voice"),
      webhook_wired: true,
    },
    { onConflict: "sid" },
  );
  await audit(admin, userId, "numbers.purchase", { number: bought.phone_number });
  return bought;
}

export async function releaseNumber(supabase: SB, userId: string, data: { sid: string }) {
  await requireOwner(supabase, userId);
  const admin = await adminClient();
  await twilioRequest({ method: "DELETE", path: `/IncomingPhoneNumbers/${data.sid}.json` });
  await admin.from("phone_numbers").delete().eq("sid", data.sid);
  await audit(admin, userId, "numbers.release", { sid: data.sid });
  return { ok: true };
}

/* -------------------------------------------------------------- messaging */

export async function sendMessage(
  supabase: SB,
  userId: string,
  data: {
    appNumber: string;
    to: string;
    body: string;
    channel: "sms" | "whatsapp";
    mediaUrls?: string[];
    sendAt?: string | null;
    messagingServiceSid?: string | null;
  },
) {
  const { numbers } = await allowedNumbers(supabase, userId);
  const appNumber = normalizePhone(data.appNumber);
  if (!numbers.includes(appNumber)) throw new Error("You are not assigned to that number.");

  const to = normalizePhone(data.to);
  const admin = await adminClient();
  const conversationId = await upsertConversation(admin, {
    channel: data.channel,
    appNumber,
    contactNumber: to,
  });

  const prefix = data.channel === "whatsapp" ? "whatsapp:" : "";
  const params: Record<string, unknown> = {
    To: `${prefix}${to}`,
    Body: data.body,
    StatusCallback: webhookUrl("status"),
  };
  if (data.channel === "whatsapp") {
    params["From"] = `${prefix}${appNumber}`;
  } else {
    const { messagingStateFor } = await import("./messaging.server");
    const state = await messagingStateFor(admin, appNumber);
    const serviceSid = data.messagingServiceSid ?? state.messagingServiceSid;

    // A US long code only delivers through a registered campaign; sending from
    // the bare number is what produced the 30034 failures.
    if (!serviceSid) {
      throw new Error(
        "This number isn't approved for texting yet. Register it for A2P messaging, then try again.",
      );
    }
    if (!data.messagingServiceSid && !state.ready) {
      throw new Error(
        `Texting from ${appNumber} is not approved yet (campaign status: ${state.campaignStatus ?? "not registered"}). Use an approved number.`,
      );
    }
    params["MessagingServiceSid"] = serviceSid;
  }
  if (data.mediaUrls?.length) params["MediaUrl"] = data.mediaUrls;
  if (data.sendAt) {
    params["SendAt"] = new Date(data.sendAt).toISOString();
    params["ScheduleType"] = "fixed";
    delete params["StatusCallback"];
  }

  let sent: { sid: string; status: string };
  try {
    sent = await twilioRequest<{ sid: string; status: string }>({
      method: "POST",
      path: "/Messages.json",
      params,
    });
  } catch (error) {
    const { friendlySendError } = await import("./messaging.server");
    const body = (error as { body?: string }).body ?? "";
    const friendly = body ? friendlySendError(body) : null;
    throw friendly ? new Error(friendly) : (error as Error);
  }

  await admin.from("messages").insert({
    conversation_id: conversationId,
    sid: sent.sid,
    direction: "outbound",
    channel: data.channel,
    from_number: appNumber,
    to_number: to,
    body: data.body,
    media: (data.mediaUrls ?? []).map((url) => ({ url })),
    status: sent.status,
    sent_by: userId,
    scheduled_for: data.sendAt ?? null,
  });
  await admin
    .from("conversations")
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: data.body?.slice(0, 140) ?? "[media]",
    })
    .eq("id", conversationId);

  return { conversationId, sid: sent.sid };
}

export async function addInternalNote(
  supabase: SB,
  userId: string,
  data: { conversationId: string; body: string },
) {
  const { data: convo } = await supabase
    .from("conversations")
    .select("app_number, contact_number, channel")
    .eq("id", data.conversationId)
    .maybeSingle();
  if (!convo) throw new Error("Conversation not found.");
  const admin = await adminClient();
  await admin.from("messages").insert({
    conversation_id: data.conversationId,
    direction: "note",
    channel: convo.channel,
    from_number: convo.app_number,
    to_number: convo.contact_number,
    body: data.body,
    is_internal_note: true,
    sent_by: userId,
  });
  return { ok: true };
}

export async function markConversationRead(
  supabase: SB,
  _userId: string,
  data: { conversationId: string },
) {
  await supabase.from("conversations").update({ unread_count: 0 }).eq("id", data.conversationId);
  return { ok: true };
}

export async function setConversationFlags(
  supabase: SB,
  _userId: string,
  data: { conversationId: string; assignedTo?: string | null; archived?: boolean },
) {
  const patch: Record<string, unknown> = {};
  if (data.assignedTo !== undefined) patch["assigned_to"] = data.assignedTo;
  if (data.archived !== undefined) patch["archived"] = data.archived;
  const { error } = await supabase
    .from("conversations")
    .update(patch)
    .eq("id", data.conversationId);
  if (error) throw error;
  return { ok: true };
}

/** Pull recent Twilio message history into the local inbox. */
export async function importHistory(supabase: SB, userId: string) {
  const { numbers } = await allowedNumbers(supabase, userId);
  if (!numbers.length) return { imported: 0 };
  const admin = await adminClient();
  const res = await twilioRequest<{
    messages: Array<{
      sid: string;
      from: string;
      to: string;
      body: string;
      status: string;
      direction: string;
      num_media: string;
      price: string | null;
      date_sent: string | null;
      date_created: string;
    }>;
  }>({ path: "/Messages.json", params: { PageSize: 200 } });

  let imported = 0;
  for (const m of res.messages ?? []) {
    const inbound = m.direction.startsWith("inbound");
    const rawApp = inbound ? m.to : m.from;
    const rawContact = inbound ? m.from : m.to;
    const channel = rawApp.startsWith("whatsapp:") ? "whatsapp" : "sms";
    const appNumber = stripChannel(rawApp);
    const contactNumber = stripChannel(rawContact);
    if (!numbers.includes(appNumber)) continue;

    const conversationId = await upsertConversation(admin, {
      channel,
      appNumber,
      contactNumber,
    });
    const { error } = await admin.from("messages").upsert(
      {
        conversation_id: conversationId,
        sid: m.sid,
        direction: inbound ? "inbound" : "outbound",
        channel,
        from_number: stripChannel(m.from),
        to_number: stripChannel(m.to),
        body: m.body,
        status: m.status,
        price: m.price,
        created_at: new Date(m.date_sent ?? m.date_created).toISOString(),
      },
      { onConflict: "sid", ignoreDuplicates: true },
    );
    if (!error) imported += 1;
  }
  return { imported };
}

/* ------------------------------------------------------------------ voice */

export async function importCallHistory(supabase: SB, userId: string) {
  const { numbers } = await allowedNumbers(supabase, userId);
  if (!numbers.length) return { imported: 0 };
  const admin = await adminClient();
  const res = await twilioRequest<{
    calls: Array<{
      sid: string;
      from: string;
      to: string;
      status: string;
      direction: string;
      duration: string | null;
      price: string | null;
      start_time: string | null;
      date_created: string;
    }>;
  }>({ path: "/Calls.json", params: { PageSize: 100 } });

  let imported = 0;
  for (const c of res.calls ?? []) {
    const inbound = c.direction.startsWith("inbound");
    const appNumber = stripChannel(inbound ? c.to : c.from);
    if (!numbers.includes(appNumber)) continue;
    const { error } = await admin.from("calls").upsert(
      {
        sid: c.sid,
        direction: inbound ? "inbound" : "outbound",
        from_number: stripChannel(c.from),
        to_number: stripChannel(c.to),
        app_number: appNumber,
        status: c.status,
        duration: c.duration ? Number(c.duration) : null,
        price: c.price,
        started_at: new Date(c.start_time ?? c.date_created).toISOString(),
      },
      { onConflict: "sid" },
    );
    if (!error) imported += 1;
  }
  return { imported };
}

export async function startCall(
  supabase: SB,
  userId: string,
  data: { appNumber: string; to: string },
) {
  const { numbers } = await allowedNumbers(supabase, userId);
  const appNumber = normalizePhone(data.appNumber);
  if (!numbers.includes(appNumber)) throw new Error("You are not assigned to that number.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("agent_phone")
    .eq("id", userId)
    .maybeSingle();
  const agentPhone = (profile?.agent_phone as string | null) || null;
  const target = normalizePhone(data.to);
  const callerId = await resolveOutboundCallerId(supabase, appNumber, target);

  const mode: "bridge" | "direct" = agentPhone ? "bridge" : "direct";

  let twiml: string;
  let to: string;
  let from: string;

  if (agentPhone) {
    // Ring the user's own phone first, then dial the contact from that leg.
    twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">Connecting your call.</Say><Dial callerId="${callerId}"><Number>${target}</Number></Dial></Response>`;
    to = normalizePhone(agentPhone);
    from = appNumber;
  } else {
    // No bridge leg configured: dial the contact directly and connect them to
    // the in-app client when a device is online, otherwise play a short prompt.
    const { voiceIdentityFor } = await import("./voice-token.server");
    const identity = voiceIdentityFor(userId);
    const since = new Date(Date.now() - 120_000).toISOString();
    const { data: presence } = await supabase
      .from("voice_presence")
      .select("identity")
      .eq("identity", identity)
      .gt("last_seen_at", since)
      .maybeSingle();

    twiml = presence
      ? `<?xml version="1.0" encoding="UTF-8"?><Response><Dial timeout="30" callerId="${callerId}"><Client>${identity}</Client></Dial></Response>`
      : `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">Please hold while we connect you.</Say><Pause length="10"/></Response>`;
    to = target;
    from = callerId;
  }

  const call = await twilioRequest<{ sid: string; status: string }>({
    method: "POST",
    path: "/Calls.json",
    params: {
      From: from,
      To: to,
      Twiml: twiml,
      StatusCallback: webhookUrl("status"),
      StatusCallbackEvent: ["completed"],
    },
  });

  const admin = await adminClient();
  await admin.from("calls").upsert(
    {
      sid: call.sid,
      direction: "outbound",
      from_number: mode === "bridge" ? appNumber : callerId,
      to_number: target,
      app_number: appNumber,
      status: call.status,
      answered_by: userId,
    },
    { onConflict: "sid" },
  );
  return { sid: call.sid, mode, callerId };
}

/**
 * Places a short confirmation call to the signed-in user's own phone using the
 * caller ID that real outbound calls would present. Verifies setup end to end.
 */
export async function sendTestCall(
  supabase: SB,
  userId: string,
  data: { appNumber?: string | null; to?: string | null },
) {
  const { numbers } = await allowedNumbers(supabase, userId);
  const { data: profile } = await supabase
    .from("profiles")
    .select("agent_phone, default_number")
    .eq("id", userId)
    .maybeSingle();

  const appNumber = normalizePhone(
    data.appNumber || (profile?.default_number as string | null) || numbers[0] || "",
  );
  if (!appNumber) throw new Error("No number is assigned to you yet.");
  if (!numbers.includes(appNumber)) throw new Error("You are not assigned to that number.");

  const destination = data.to || (profile?.agent_phone as string | null) || "";
  if (!destination) {
    throw new Error("Add your own phone number in Settings first so we know where to call.");
  }
  const target = normalizePhone(destination);
  const callerId = await resolveOutboundCallerId(supabase, appNumber, target);

  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Pause length="1"/><Say voice="alice">This is a SixVox test call. Your outbound calling is working. Goodbye.</Say><Hangup/></Response>`;

  const call = await twilioRequest<{ sid: string; status: string }>({
    method: "POST",
    path: "/Calls.json",
    params: {
      From: callerId,
      To: target,
      Twiml: twiml,
      Timeout: 25,
      StatusCallback: webhookUrl("status"),
      StatusCallbackEvent: ["completed"],
    },
  });

  const admin = await adminClient();
  await audit(admin, userId, "calls.test", { appNumber, callerId, to: target });
  return { sid: call.sid, callerId, to: target, appNumber };
}

export async function getCallRecordings(supabase: SB, userId: string, data: { sid: string }) {
  await allowedNumbers(supabase, userId);
  const res = await twilioRequest<{
    recordings: Array<{ sid: string; duration: string; date_created: string }>;
  }>({ path: `/Calls/${data.sid}/Recordings.json` });
  return (res.recordings ?? []).map((r) => ({
    sid: r.sid,
    duration: r.duration,
    date_created: r.date_created,
  }));
}

export async function getRecordingAudio(supabase: SB, userId: string, data: { sid: string }) {
  await allowedNumbers(supabase, userId);
  const sid = process.env["TWILIO_ACCOUNT_SID"];
  const token = process.env["TWILIO_AUTH_TOKEN"];
  const response = sid && token
    ? await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Recordings/${data.sid}.mp3`,
        { headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}` } },
      )
    : await fetch(`https://connector-gateway.lovable.dev/twilio/Recordings/${data.sid}.mp3`, {
        headers: {
          Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]!}`,
          "X-Connection-Api-Key": process.env["TWILIO_API_KEY"]!,
        },
      });
  if (!response.ok) throw new Error(`Could not load recording [${response.status}]`);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  const base64 = btoa(binary);
  return { dataUrl: `data:audio/mpeg;base64,${base64}` };
}

/* --------------------------------------------------------- verify + lookup */

export async function listVerifyServices(supabase: SB, userId: string) {
  await allowedNumbers(supabase, userId);
  const res = await twilioRequest<{ services: unknown[] }>({
    host: "verify",
    path: "/v2/Services",
    params: { PageSize: 50 },
  });
  return asJson(res.services ?? []) as Json[];
}

export async function createVerifyService(supabase: SB, userId: string, data: { name: string }) {
  await requireAdmin(supabase, userId);
  return asJson(
    await twilioRequest({
      host: "verify",
      method: "POST",
      path: "/v2/Services",
      params: { FriendlyName: data.name },
    }),
  );
}

export async function startVerification(
  supabase: SB,
  userId: string,
  data: { serviceSid: string; to: string; channel: string },
) {
  await allowedNumbers(supabase, userId);
  return asJson(
    await twilioRequest({
      host: "verify",
      method: "POST",
      path: `/v2/Services/${data.serviceSid}/Verifications`,
      params: { To: normalizePhone(data.to), Channel: data.channel },
    }),
  );
}

export async function checkVerification(
  supabase: SB,
  userId: string,
  data: { serviceSid: string; to: string; code: string },
) {
  await allowedNumbers(supabase, userId);
  return asJson(
    await twilioRequest({
      host: "verify",
      method: "POST",
      path: `/v2/Services/${data.serviceSid}/VerificationCheck`,
      params: { To: normalizePhone(data.to), Code: data.code },
    }),
  );
}

export async function lookupNumber(supabase: SB, userId: string, data: { phone: string }) {
  const phone = normalizePhone(data.phone);
  const result = await twilioRequest<Record<string, unknown>>({
    host: "lookups",
    path: `/v2/PhoneNumbers/${encodeURIComponent(phone)}`,
    params: { Fields: "line_type_intelligence,caller_name" },
  });
  const admin = await adminClient();
  await admin
    .from("lookups")
    .insert({ phone_number: phone, result: result as never, looked_up_by: userId });
  return asJson(result);
}

export async function listLookups(supabase: SB, userId: string) {
  const { data } = await supabase
    .from("lookups")
    .select("*")
    .eq("looked_up_by", userId)
    .order("created_at", { ascending: false })
    .limit(25);
  return data ?? [];
}

/* ----------------------------------------------------------- account admin */

export async function accountOverview(supabase: SB, userId: string) {
  await requireAdmin(supabase, userId);
  const [balance, usage, subaccounts, services, account] = await Promise.all([
    twilioRequest<Record<string, unknown>>({ path: "/Balance.json" }).catch(() => null),
    twilioRequest<{ usage_records: unknown[] }>({
      path: "/Usage/Records/ThisMonth.json",
      params: { PageSize: 30 },
    }).catch(() => ({ usage_records: [] })),
    twilioRequest<{ accounts: unknown[] }>({
      host: "api-direct",
      path: "/2010-04-01/Accounts.json",
      params: { PageSize: 30 },
    }).catch(() => ({ accounts: [] })),
    twilioRequest<{ services: unknown[] }>({
      host: "messaging",
      path: "/v1/Services",
      params: { PageSize: 30 },
    }).catch(() => ({ services: [] })),
    accountStatus().catch(() => null),
  ]);
  return asJson({
    balance,
    usage: usage.usage_records ?? [],
    subaccounts: (subaccounts as { accounts?: unknown[] }).accounts ?? [],
    messagingServices: (services as { services?: unknown[] }).services ?? [],
    account,
  }) as {
    balance: Json;
    usage: Json[];
    subaccounts: Json[];
    messagingServices: Json[];
    account: Json;
  };
}

/** Identity + transport status for the Twilio connection powering this app. */
export async function accountStatus() {
  const sid = process.env["TWILIO_ACCOUNT_SID"];
  const direct = hasDirectCredentials();
  const health = await credentialHealth();
  const account =
    sid && health.healthy
      ? await twilioRequest<{
          friendly_name: string;
          status: string;
          type: string;
          sid: string;
        }>({ host: "api-direct", path: `/2010-04-01/Accounts/${sid}.json` }).catch(() => null)
      : null;
  return asJson({
    directApi: direct,
    friendlyName: account?.friendly_name ?? null,
    status: account?.status ?? null,
    type: account?.type ?? null,
    sidSuffix: account?.sid ? account.sid.slice(-4) : sid ? sid.slice(-4) : null,
    credentialsOk: health.healthy,
    credentialMessage: health.message,
  });
}

/* ------------------------------------------------------- messaging services */

type MessagingService = {
  sid: string;
  friendly_name: string;
  use_inbound_webhook_on_number?: boolean;
  inbound_request_url?: string | null;
  status_callback?: string | null;
};

export async function listMessagingServices(supabase: SB, userId: string) {
  await requireAdmin(supabase, userId);
  const res = await twilioRequest<{ services: MessagingService[] }>({
    host: "messaging",
    path: "/v1/Services",
    params: { PageSize: 50 },
  });
  return asJson(res.services ?? []) as Json[];
}

/** Pool numbers plus A2P brand/campaign registration state for one service. */
export async function messagingServiceDetail(
  supabase: SB,
  userId: string,
  data: { serviceSid: string },
) {
  await requireAdmin(supabase, userId);
  const [numbers, compliance] = await Promise.all([
    twilioRequest<{ phone_numbers: Array<{ sid: string; phone_number: string }> }>({
      host: "messaging",
      path: `/v1/Services/${data.serviceSid}/PhoneNumbers`,
      params: { PageSize: 50 },
    }).catch(() => ({ phone_numbers: [] })),
    twilioRequest<Record<string, unknown>>({
      host: "messaging",
      path: `/v1/Services/${data.serviceSid}/Compliance/Usa2p`,
      params: { PageSize: 5 },
    }).catch(() => null),
  ]);
  const campaigns =
    (compliance as { compliance?: unknown[] } | null)?.compliance ??
    (compliance ? [compliance] : []);
  return asJson({
    numbers: numbers.phone_numbers ?? [],
    campaigns,
  }) as { numbers: Json[]; campaigns: Json[] };
}

export async function addNumberToMessagingService(
  supabase: SB,
  userId: string,
  data: { serviceSid: string; numberSid: string },
) {
  await requireAdmin(supabase, userId);
  const result = await twilioRequest({
    host: "messaging",
    method: "POST",
    path: `/v1/Services/${data.serviceSid}/PhoneNumbers`,
    params: { PhoneNumberSid: data.numberSid },
  });
  const admin = await adminClient();
  await audit(admin, userId, "messaging.pool.add", data as unknown as Record<string, unknown>);
  return asJson(result);
}

export async function removeNumberFromMessagingService(
  supabase: SB,
  userId: string,
  data: { serviceSid: string; numberSid: string },
) {
  await requireAdmin(supabase, userId);
  await twilioRequest({
    host: "messaging",
    method: "DELETE",
    path: `/v1/Services/${data.serviceSid}/PhoneNumbers/${data.numberSid}`,
  });
  const admin = await adminClient();
  await audit(admin, userId, "messaging.pool.remove", data as unknown as Record<string, unknown>);
  return { ok: true };
}

export async function createMessagingService(
  supabase: SB,
  userId: string,
  data: { name: string },
) {
  await requireOwner(supabase, userId);
  const result = await twilioRequest<MessagingService>({
    host: "messaging",
    method: "POST",
    path: "/v1/Services",
    params: {
      FriendlyName: data.name,
      InboundRequestUrl: webhookUrl("sms"),
      StatusCallback: webhookUrl("status"),
      UseInboundWebhookOnNumber: false,
    },
  });
  const admin = await adminClient();
  await audit(admin, userId, "messaging.service.create", { sid: result.sid, name: data.name });
  return asJson(result);
}

/* -------------------------------------------------------------- API console */

export async function rawTwilioCall(
  supabase: SB,
  userId: string,
  data: { method: string; path: string; host: string; params: string },
) {
  await requireOwner(supabase, userId);
  let params: Record<string, unknown> = {};
  if (data.params.trim()) {
    try {
      params = JSON.parse(data.params) as Record<string, unknown>;
    } catch {
      throw new Error("Parameters must be valid JSON, e.g. {\"PageSize\": 5}");
    }
  }
  const admin = await adminClient();
  await audit(admin, userId, "api.raw", { method: data.method, path: data.path, host: data.host });
  try {
    const result = await twilioRequest({
      method: data.method as "GET" | "POST" | "PUT" | "DELETE",
      path: data.path.startsWith("/") ? data.path : `/${data.path}`,
      host: data.host as TwilioHost,
      params,
    });
    return { ok: true, status: 200, result: asJson(result) };
  } catch (error) {
    const err = error as { status?: number; body?: string; message: string };
    return { ok: false, status: err.status ?? 500, result: asJson(err.body ?? err.message) };
  }
}

/* ------------------------------------------------------------------- team */

export async function listTeam(supabase: SB, userId: string) {
  await requireAdmin(supabase, userId);
  const [{ data: profiles }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at"),
    supabase.from("user_roles").select("user_id, role"),
  ]);
  return (profiles ?? []).map((p) => ({
    ...p,
    roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as string),
  }));
}

export async function setTeamRole(
  supabase: SB,
  userId: string,
  data: { targetUserId: string; role: "owner" | "admin" | "agent" },
) {
  await requireOwner(supabase, userId);
  const admin = await adminClient();
  await admin.from("user_roles").delete().eq("user_id", data.targetUserId);
  await admin.from("user_roles").insert({ user_id: data.targetUserId, role: data.role });
  await audit(admin, userId, "team.role", data as unknown as Record<string, unknown>);
  return { ok: true };
}

export async function updateMyProfile(
  supabase: SB,
  userId: string,
  data: { displayName?: string; agentPhone?: string | null },
) {
  const patch: Record<string, unknown> = {};
  if (data.displayName !== undefined) patch["display_name"] = data.displayName;
  if (data.agentPhone !== undefined)
    patch["agent_phone"] = data.agentPhone ? normalizePhone(data.agentPhone) : null;
  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) throw error;
  return { ok: true };
}

/* ---------------------------------------------------------------- media */

/** Signed, time-limited URL Twilio can fetch for an MMS attachment. */
export async function signMediaUrl(supabase: SB, _userId: string, data: { path: string }) {
  const { data: signed, error } = await supabase.storage
    .from("mms-media")
    .createSignedUrl(data.path, 60 * 60 * 24);
  if (error) throw error;
  return { url: signed.signedUrl };
}

/* ------------------------------------------------------------ twiml apps */

type TwimlApp = {
  sid: string;
  friendly_name: string;
  voice_url?: string | null;
  sms_url?: string | null;
  voice_method?: string | null;
  status_callback?: string | null;
};

/** SID of the TwiML App this workspace uses for in-app calling, if any. */
export async function defaultTwimlAppSid(admin: SB): Promise<string | null> {
  const { data } = await admin
    .from("twiml_apps")
    .select("sid")
    .eq("is_default", true)
    .maybeSingle();
  return (data?.sid as string | undefined) ?? null;
}

function twimlAppParams() {
  return {
    VoiceUrl: webhookUrl("app-voice"),
    VoiceMethod: "POST",
    VoiceFallbackUrl: webhookUrl("app-voice"),
    VoiceFallbackMethod: "POST",
    StatusCallback: webhookUrl("status"),
    StatusCallbackMethod: "POST",
    SmsUrl: webhookUrl("sms"),
    SmsMethod: "POST",
    SmsFallbackUrl: webhookUrl("sms"),
    SmsFallbackMethod: "POST",
    SmsStatusCallback: webhookUrl("status"),
  };
}

export async function listTwimlApps(supabase: SB, userId: string) {
  await requireAdmin(supabase, userId);
  const admin = await adminClient();
  const [remote, { data: local }] = await Promise.all([
    twilioRequest<{ applications: TwimlApp[] }>({
      path: "/Applications.json",
      params: { PageSize: 50 },
    }).catch(() => ({ applications: [] as TwimlApp[] })),
    admin.from("twiml_apps").select("sid, is_default"),
  ]);
  const defaults = new Set(
    (local ?? []).filter((row) => row.is_default).map((row) => row.sid as string),
  );
  return asJson(
    (remote.applications ?? []).map((app) => ({ ...app, is_default: defaults.has(app.sid) })),
  ) as Json[];
}

export async function createTwimlApp(supabase: SB, userId: string, data: { name: string }) {
  await requireOwner(supabase, userId);
  const app = await twilioRequest<TwimlApp>({
    method: "POST",
    path: "/Applications.json",
    params: { FriendlyName: data.name, ...twimlAppParams() },
  });
  const admin = await adminClient();
  const { count } = await admin.from("twiml_apps").select("id", { count: "exact", head: true });
  await admin.from("twiml_apps").upsert(
    {
      sid: app.sid,
      friendly_name: app.friendly_name,
      voice_url: webhookUrl("app-voice"),
      sms_url: webhookUrl("sms"),
      is_default: (count ?? 0) === 0,
    },
    { onConflict: "sid" },
  );
  await audit(admin, userId, "twiml.app.create", { sid: app.sid, name: data.name });
  return asJson(app);
}

/** Re-point an existing TwiML App (ours or one made in the Twilio console) at SixVox. */
export async function syncTwimlApp(supabase: SB, userId: string, data: { sid: string }) {
  await requireOwner(supabase, userId);
  const app = await twilioRequest<TwimlApp>({
    method: "POST",
    path: `/Applications/${data.sid}.json`,
    params: twimlAppParams(),
  });
  const admin = await adminClient();
  await admin.from("twiml_apps").upsert(
    {
      sid: app.sid,
      friendly_name: app.friendly_name,
      voice_url: webhookUrl("app-voice"),
      sms_url: webhookUrl("sms"),
    },
    { onConflict: "sid" },
  );
  await audit(admin, userId, "twiml.app.sync", { sid: data.sid });
  return asJson(app);
}

export async function setDefaultTwimlApp(supabase: SB, userId: string, data: { sid: string }) {
  await requireOwner(supabase, userId);
  const app = await twilioRequest<TwimlApp>({ path: `/Applications/${data.sid}.json` });
  const admin = await adminClient();
  await admin.from("twiml_apps").update({ is_default: false }).eq("is_default", true);
  await admin.from("twiml_apps").upsert(
    {
      sid: app.sid,
      friendly_name: app.friendly_name,
      voice_url: app.voice_url ?? null,
      sms_url: app.sms_url ?? null,
      is_default: true,
    },
    { onConflict: "sid" },
  );
  await audit(admin, userId, "twiml.app.default", { sid: data.sid });
  return { ok: true };
}

export async function deleteTwimlApp(supabase: SB, userId: string, data: { sid: string }) {
  await requireOwner(supabase, userId);
  await twilioRequest({ method: "DELETE", path: `/Applications/${data.sid}.json` });
  const admin = await adminClient();
  await admin.from("twiml_apps").delete().eq("sid", data.sid);
  await audit(admin, userId, "twiml.app.delete", { sid: data.sid });
  return { ok: true };
}

/* ------------------------------------------------------------ voice token */

/** Short-lived Voice SDK token for the signed-in user's device. */
export async function voiceToken(supabase: SB, userId: string) {
  const admin = await adminClient();
  const appSid = await defaultTwimlAppSid(admin);
  if (!appSid) {
    return {
      ok: false as const,
      reason: "In-app calling isn't set up yet. An admin can create the TwiML App in Settings.",
    };
  }
  await allowedNumbers(supabase, userId);
  const { mintVoiceToken } = await import("./voice-token.server");
  return { ok: true as const, grant: asJson(await mintVoiceToken({ userId, applicationSid: appSid })) };
}

export async function voiceSetupStatus(supabase: SB, userId: string) {
  await requireAdmin(supabase, userId);
  const admin = await adminClient();
  const { data } = await admin
    .from("twiml_apps")
    .select("sid, friendly_name, voice_url, sms_url, is_default")
    .order("created_at", { ascending: true });
  return asJson({
    apps: data ?? [],
    hasApiKey: Boolean(
      process.env["TWILIO_API_KEY_SID"] && process.env["TWILIO_API_KEY_SECRET"],
    ),
    hasDefault: (data ?? []).some((row) => row.is_default === true),
    voiceUrl: webhookUrl("app-voice"),
    smsUrl: webhookUrl("sms"),
    statusUrl: webhookUrl("status"),
  });
}

/**
 * Heartbeat from a registered Voice SDK device. Inbound calls only ring
 * clients seen recently — otherwise the caller hears 20 seconds of silence
 * before falling through to voicemail.
 */
export async function setVoicePresence(supabase: SB, userId: string, online: boolean) {
  const admin = await adminClient();
  const { voiceIdentityFor } = await import("./voice-token.server");
  const identity = voiceIdentityFor(userId);
  if (!online) {
    await admin.from("voice_presence").delete().eq("user_id", userId);
    return asJson({ ok: true, online: false });
  }
  await admin
    .from("voice_presence")
    .upsert(
      { user_id: userId, identity, last_seen_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  return asJson({ ok: true, online: true, identity });
}
/* ------------------------------------------------------ webhook diagnostics */

/** Recent app-side webhook failures plus the carrier's own debugger alerts. */
export async function webhookDiagnostics(supabase: SB, userId: string) {
  await requireAdmin(supabase, userId);
  const { recentTwilioAlerts } = await import("./webhook-errors.server");
  const [{ data: logged }, alerts, health] = await Promise.all([
    supabase
      .from("webhook_errors")
      .select("id, source, error_code, message, url, call_sid, app_number, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    recentTwilioAlerts(20).catch(() => []),
    credentialHealth().catch(() => null),
  ]);
  return asJson({ logged: logged ?? [], alerts, health });
}
