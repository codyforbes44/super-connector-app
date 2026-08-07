import type { SupabaseClient } from "@supabase/supabase-js";

import {
  allowedNumbers,
  audit,
  getRole,
  isAdminRole,
  requireAdmin,
  upsertConversation,
  webhookUrl,
} from "./app.server";
import {
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
};

export async function syncNumbers(supabase: SB, userId: string) {
  await requireAdmin(supabase, userId);
  const admin = await adminClient();
  const res = await twilioRequest<{ incoming_phone_numbers: TwilioNumber[] }>({
    path: "/IncomingPhoneNumbers.json",
    params: { PageSize: 200 },
  });
  const list = res.incoming_phone_numbers ?? [];
  for (const n of list) {
    await admin.from("phone_numbers").upsert(
      {
        sid: n.sid,
        phone_number: n.phone_number,
        friendly_name: n.friendly_name,
        capabilities: n.capabilities ?? {},
        webhook_wired: Boolean(n.sms_url && n.sms_url.includes("/api/public/twilio/")),
      },
      { onConflict: "sid" },
    );
  }
  const sids = list.map((n) => n.sid);
  if (sids.length) {
    await admin.from("phone_numbers").delete().not("sid", "in", `(${sids.join(",")})`);
  }
  await audit(admin, userId, "numbers.sync", { count: list.length });
  const { data } = await supabase.from("phone_numbers").select("*").order("phone_number");
  return data ?? [];
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

export async function wireNumber(
  supabase: SB,
  userId: string,
  data: { sid: string; applicationSid?: string | null },
) {
  await requireAdmin(supabase, userId);
  const admin = await adminClient();
  const appSid = data.applicationSid ?? (await defaultTwimlAppSid(admin));
  if (appSid) {
    await twilioRequest({
      method: "POST",
      path: `/IncomingPhoneNumbers/${data.sid}.json`,
      params: {
        VoiceApplicationSid: appSid,
        SmsApplicationSid: appSid,
        StatusCallback: webhookUrl("status"),
        StatusCallbackMethod: "POST",
      },
    });
    await admin.from("phone_numbers").update({ webhook_wired: true }).eq("sid", data.sid);
    await audit(admin, userId, "numbers.wire", { sid: data.sid, applicationSid: appSid });
    return { ok: true, applicationSid: appSid };
  }
  await twilioRequest({
    method: "POST",
    path: `/IncomingPhoneNumbers/${data.sid}.json`,
    params: {
      SmsUrl: webhookUrl("sms"),
      SmsMethod: "POST",
      VoiceUrl: webhookUrl("voice"),
      VoiceMethod: "POST",
      StatusCallback: webhookUrl("status"),
      StatusCallbackMethod: "POST",
      SmsApplicationSid: "",
      VoiceApplicationSid: "",
    },
  });
  await admin.from("phone_numbers").update({ webhook_wired: true }).eq("sid", data.sid);
  await audit(admin, userId, "numbers.wire", { sid: data.sid });
  return { ok: true, applicationSid: null };
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
  await requireAdmin(supabase, userId);
  const admin = await adminClient();
  const bought = await twilioRequest<TwilioNumber>({
    method: "POST",
    path: "/IncomingPhoneNumbers.json",
    params: {
      PhoneNumber: data.phoneNumber,
      SmsUrl: webhookUrl("sms"),
      SmsMethod: "POST",
      VoiceUrl: webhookUrl("voice"),
      VoiceMethod: "POST",
      StatusCallback: webhookUrl("status"),
    },
  });
  await admin.from("phone_numbers").upsert(
    {
      sid: bought.sid,
      phone_number: bought.phone_number,
      friendly_name: bought.friendly_name,
      capabilities: bought.capabilities ?? {},
      webhook_wired: true,
    },
    { onConflict: "sid" },
  );
  await audit(admin, userId, "numbers.purchase", { number: bought.phone_number });
  return bought;
}

export async function releaseNumber(supabase: SB, userId: string, data: { sid: string }) {
  await requireAdmin(supabase, userId);
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
  if (data.messagingServiceSid && data.channel === "sms") {
    params["MessagingServiceSid"] = data.messagingServiceSid;
  } else {
    params["From"] = `${prefix}${appNumber}`;
  }
  if (data.mediaUrls?.length) params["MediaUrl"] = data.mediaUrls;
  if (data.sendAt) {
    params["SendAt"] = new Date(data.sendAt).toISOString();
    params["ScheduleType"] = "fixed";
    delete params["StatusCallback"];
  }

  const sent = await twilioRequest<{ sid: string; status: string }>({
    method: "POST",
    path: "/Messages.json",
    params,
  });

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
  const agentPhone = profile?.agent_phone as string | undefined;
  if (!agentPhone) {
    throw new Error("Add your own phone number in Settings first — we call you, then the contact.");
  }

  const target = normalizePhone(data.to);
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">Connecting your call.</Say><Dial callerId="${appNumber}"><Number>${target}</Number></Dial></Response>`;

  const call = await twilioRequest<{ sid: string; status: string }>({
    method: "POST",
    path: "/Calls.json",
    params: {
      From: appNumber,
      To: normalizePhone(agentPhone),
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
      from_number: appNumber,
      to_number: target,
      app_number: appNumber,
      status: call.status,
      answered_by: userId,
    },
    { onConflict: "sid" },
  );
  return { sid: call.sid };
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
  const account = sid
    ? await twilioRequest<{
        friendly_name: string;
        status: string;
        type: string;
        sid: string;
      }>({ host: "api-direct", path: `/2010-04-01/Accounts/${sid}.json` })
    : null;
  return asJson({
    directApi: direct,
    friendlyName: account?.friendly_name ?? null,
    status: account?.status ?? null,
    type: account?.type ?? null,
    sidSuffix: account?.sid ? account.sid.slice(-4) : null,
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
  await requireAdmin(supabase, userId);
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
  await requireAdmin(supabase, userId);
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
  const role = await getRole(supabase, userId);
  if (role !== "owner") throw new Error("Only the account owner can change roles.");
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
  await requireAdmin(supabase, userId);
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

/** Re-point an existing TwiML App (ours or one made in the Twilio console) at Signalbox. */
export async function syncTwimlApp(supabase: SB, userId: string, data: { sid: string }) {
  await requireAdmin(supabase, userId);
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
  await requireAdmin(supabase, userId);
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
  await requireAdmin(supabase, userId);
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
    throw new Error(
      "In-app calling isn't set up yet. An admin can create the TwiML App in Settings.",
    );
  }
  await allowedNumbers(supabase, userId);
  const { mintVoiceToken } = await import("./voice-token.server");
  return asJson(await mintVoiceToken({ userId, applicationSid: appSid }));
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
    voiceUrl: webhookUrl("app-voice"),
    smsUrl: webhookUrl("sms"),
    statusUrl: webhookUrl("status"),
  });
}