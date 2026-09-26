import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { allowedNumbers, getRole, isAdminRole } from "@/lib/app.server";
import { authenticateMobileRequest, mobileJson } from "@/lib/mobile-auth.server";
import {
  parseCallSidBody,
  parsePresenceBody,
  parseProfileBody,
  parseReadBody,
  parseSendMessageBody,
  parseVoiceTokenBody,
} from "@/lib/mobile-api-parse";
import { mobilePresenceIdentity } from "@/lib/mobile-presence";
import { resolvePushCredentialSid } from "@/lib/mobile-push-credentials";
import * as ops from "@/lib/twilio-ops.server";

import type { SupabaseClient } from "@supabase/supabase-js";

type UserClient = SupabaseClient<Database>;

function splatOf(raw: string | undefined): string {
  return (raw ?? "").replace(/^\/+|\/+$/g, "");
}

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function bad(error: string, status = 400): Response {
  return mobileJson({ ok: false, error }, status);
}

async function assertNumberAccess(
  supabase: UserClient,
  userId: string,
  appNumber: string,
): Promise<boolean> {
  const { numbers } = await allowedNumbers(supabase, userId);
  return numbers.includes(appNumber);
}

export async function handleMobileRequest(
  request: Request,
  method: string,
  rawSplat: string | undefined,
): Promise<Response> {
  const route = `${method} ${splatOf(rawSplat)}`;
  if (route === "GET health") return mobileJson({ ok: true, service: "mobile" });

  const auth = await authenticateMobileRequest(request);
  if (!auth.ok) return auth.response;
  const { supabase, userId } = auth;

  try {
    switch (route) {
      case "GET bootstrap":
        return await bootstrap(supabase, userId);
      case "POST voice/token":
        return await voiceToken(supabase, userId, await readJson(request));
      case "POST voice/presence":
        return await presence(userId, await readJson(request));
      case "POST voice/ack":
        return await ack(supabase, userId, await readJson(request));
      case "GET inbox":
        return await inbox(supabase, userId, new URL(request.url));
      case "GET messages":
        return await messages(supabase, userId, new URL(request.url));
      case "POST messages/send":
        return await send(supabase, userId, await readJson(request));
      case "POST conversations/read":
        return await markRead(supabase, userId, await readJson(request));
      case "GET calls":
        return await calls(supabase, userId);
      case "GET voicemail":
        return await voicemail(supabase, userId);
      case "POST voicemail/audio":
        return await voicemailAudio(supabase, userId, await readJson(request));
      case "POST profile":
        return await profile(supabase, userId, await readJson(request));
      default:
        return bad("Unknown mobile endpoint.", 404);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed.";
    const status = /forbidden/i.test(message) ? 403 : 400;
    console.error("mobile API", route, message);
    return bad(message, status);
  }
}

async function bootstrap(supabase: UserClient, userId: string): Promise<Response> {
  const [{ data: profile }, role, access] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, email, agent_phone, default_number, workspace_name")
      .eq("id", userId)
      .maybeSingle(),
    getRole(supabase, userId),
    allowedNumbers(supabase, userId),
  ]);

  const numbers = access.numbers.length
    ? ((
        await supabase
          .from("phone_numbers")
          .select("sid, phone_number, friendly_name, assigned_to, outbound_caller_id")
          .in("phone_number", access.numbers)
          .order("phone_number")
      ).data ?? [])
    : [];

  return mobileJson({
    ok: true,
    profile,
    role,
    isAdmin: isAdminRole(role),
    numbers,
  });
}

async function voiceToken(supabase: UserClient, userId: string, body: unknown): Promise<Response> {
  const parsed = parseVoiceTokenBody(body);
  if ("error" in parsed) return bad(parsed.error);
  const pushCredentialSid = resolvePushCredentialSid({
    platform: parsed.platform,
    environment: parsed.environment,
    workspaceId: null,
  });
  const result = await ops.voiceToken(supabase, userId, { pushCredentialSid });
  return mobileJson(result, result.ok ? 200 : 409);
}

async function presence(userId: string, body: unknown): Promise<Response> {
  const parsed = parsePresenceBody(body);
  if ("error" in parsed) return bad(parsed.error);
  const identity = mobilePresenceIdentity(userId, parsed.platform, parsed.deviceId);
  if (!parsed.online) {
    await supabaseAdmin
      .from("voice_presence")
      .delete()
      .eq("user_id", userId)
      .eq("identity", identity);
    return mobileJson({ ok: true, online: false, identity });
  }

  const row = {
    user_id: userId,
    identity,
    platform: parsed.platform,
    device_key: parsed.deviceId,
    last_seen_at: new Date().toISOString(),
  };
  const wrote = await supabaseAdmin.from("voice_presence").upsert(row, { onConflict: "identity" });
  if (wrote.error && /platform|device_key/i.test(wrote.error.message)) {
    const retry = await supabaseAdmin
      .from("voice_presence")
      .upsert(
        { user_id: userId, identity, last_seen_at: row.last_seen_at },
        { onConflict: "identity" },
      );
    if (retry.error) throw new Error(retry.error.message);
  } else if (wrote.error) {
    throw new Error(wrote.error.message);
  }
  return mobileJson({ ok: true, online: true, identity });
}

async function ack(supabase: UserClient, userId: string, body: unknown): Promise<Response> {
  const parsed = parseCallSidBody(body);
  if ("error" in parsed) return bad(parsed.error);
  const { data: call, error } = await supabaseAdmin
    .from("calls")
    .select("app_number")
    .eq("sid", parsed.callSid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!call) return bad("Call not found.", 404);
  if (!(await assertNumberAccess(supabase, userId, call.app_number))) {
    return bad("You cannot acknowledge that call.", 403);
  }
  const saved = await supabaseAdmin
    .from("mobile_call_acks")
    .upsert(
      { call_sid: parsed.callSid, user_id: userId, acked_at: new Date().toISOString() },
      { onConflict: "call_sid" },
    );
  if (saved.error) throw new Error(saved.error.message);
  return mobileJson({ ok: true });
}

async function inbox(supabase: UserClient, userId: string, url: URL): Promise<Response> {
  const { numbers } = await allowedNumbers(supabase, userId);
  if (!numbers.length) return mobileJson({ ok: true, conversations: [] });
  let query = supabase
    .from("conversations")
    .select(
      "id, app_number, contact_number, contact_name, channel, last_message_at, last_message_preview, unread_count, opted_out",
    )
    .eq("archived", false)
    .in("app_number", numbers)
    .order("last_message_at", { ascending: false })
    .limit(100);
  const q = url.searchParams.get("q")?.trim();
  if (q) {
    const like = `%${q.replace(/[%_,.()]/g, "")}%`;
    query = query.or(
      `contact_number.ilike.${like},contact_name.ilike.${like},last_message_preview.ilike.${like}`,
    );
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return mobileJson({ ok: true, conversations: data ?? [] });
}

async function messages(supabase: UserClient, userId: string, url: URL): Promise<Response> {
  const conversationId = url.searchParams.get("conversationId")?.trim();
  if (!conversationId) return bad("conversationId is required.");
  const { data: convo, error: convoError } = await supabase
    .from("conversations")
    .select("id, app_number, contact_number, contact_name, channel, opted_out")
    .eq("id", conversationId)
    .maybeSingle();
  if (convoError) throw new Error(convoError.message);
  if (!convo) return bad("Conversation not found.", 404);
  if (!(await assertNumberAccess(supabase, userId, convo.app_number))) {
    return bad("You cannot read that conversation.", 403);
  }
  const { data, error } = await supabase
    .from("messages")
    .select("id, direction, body, created_at, status, from_number, to_number, is_internal_note")
    .eq("conversation_id", conversationId)
    .eq("is_internal_note", false)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);
  return mobileJson({ ok: true, conversation: convo, messages: data ?? [] });
}

async function send(supabase: UserClient, userId: string, body: unknown): Promise<Response> {
  const parsed = parseSendMessageBody(body);
  if ("error" in parsed) return bad(parsed.error);
  const result = await ops.sendMessage(supabase, userId, { ...parsed, channel: "sms" });
  return mobileJson({ ok: true, ...result });
}

async function markRead(supabase: UserClient, userId: string, body: unknown): Promise<Response> {
  const parsed = parseReadBody(body);
  if ("error" in parsed) return bad(parsed.error);
  const { data: convo } = await supabase
    .from("conversations")
    .select("app_number")
    .eq("id", parsed.conversationId)
    .maybeSingle();
  if (!convo) return bad("Conversation not found.", 404);
  if (!(await assertNumberAccess(supabase, userId, convo.app_number))) {
    return bad("You cannot update that conversation.", 403);
  }
  await ops.markConversationRead(supabase, userId, parsed);
  return mobileJson({ ok: true });
}

async function calls(supabase: UserClient, userId: string): Promise<Response> {
  const { numbers } = await allowedNumbers(supabase, userId);
  if (!numbers.length) return mobileJson({ ok: true, calls: [] });
  const { data, error } = await supabase
    .from("calls")
    .select(
      "sid, direction, from_number, to_number, app_number, status, duration, started_at, recording_url, transcription, answered_in_app",
    )
    .in("app_number", numbers)
    .order("started_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const sids = rows.map((row) => row.sid);
  const intel = sids.length
    ? ((
        await supabase
          .from("call_intelligence")
          .select("call_sid, summary, intent, sentiment, urgency, topics")
          .in("call_sid", sids)
      ).data ?? [])
    : [];
  const bySid = new Map(intel.map((row) => [row.call_sid, row]));
  return mobileJson({
    ok: true,
    calls: rows.map((row) => ({ ...row, intelligence: bySid.get(row.sid) ?? null })),
  });
}

async function voicemail(supabase: UserClient, userId: string): Promise<Response> {
  const { numbers } = await allowedNumbers(supabase, userId);
  if (!numbers.length) return mobileJson({ ok: true, voicemails: [] });
  const { data, error } = await supabase
    .from("calls")
    .select("sid, from_number, app_number, started_at, duration, transcription, recording_url")
    .in("app_number", numbers)
    .or("recording_url.not.is.null,transcription.not.is.null")
    .order("started_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return mobileJson({ ok: true, voicemails: data ?? [] });
}

async function voicemailAudio(
  supabase: UserClient,
  userId: string,
  body: unknown,
): Promise<Response> {
  const parsed = parseCallSidBody(body);
  if ("error" in parsed) return bad(parsed.error);
  const { data: call, error } = await supabase
    .from("calls")
    .select("app_number, recording_url")
    .eq("sid", parsed.callSid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!call) return bad("Call not found.", 404);
  if (!(await assertNumberAccess(supabase, userId, call.app_number))) {
    return bad("You cannot play that voicemail.", 403);
  }
  const recordings = await ops.getCallRecordings(supabase, userId, { sid: parsed.callSid });
  const first = recordings[0];
  if (!first) return bad("No recording on that call.", 404);
  const audio = await ops.getRecordingAudio(supabase, userId, { sid: first.sid });
  return mobileJson({ ok: true, recordingSid: first.sid, duration: first.duration, ...audio });
}

async function profile(supabase: UserClient, userId: string, body: unknown): Promise<Response> {
  const parsed = parseProfileBody(body);
  if ("error" in parsed) return bad(parsed.error);
  await ops.updateMyProfile(supabase, userId, parsed);
  return mobileJson({ ok: true });
}
