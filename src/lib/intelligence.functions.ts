import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Summaries for a batch of calls shown in a list. */
export const getCallIntelligence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { callSids: string[] }) => input)
  .handler(async ({ context, data }) => {
    if (!data.callSids.length) return [];
    const { data: rows } = await context.supabase
      .from("call_intelligence")
      .select("call_sid, summary, intent, sentiment, urgency, topics, entities, action_items")
      .in("call_sid", data.callSids.slice(0, 200));
    return rows ?? [];
  });

/** Everything we know about one call: analysis plus stored transcript. */
export const getCallDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { callSid: string }) => input)
  .handler(async ({ context, data }) => {
    const [{ data: intel }, { data: transcripts }] = await Promise.all([
      context.supabase
        .from("call_intelligence")
        .select("*")
        .eq("call_sid", data.callSid)
        .maybeSingle(),
      context.supabase
        .from("call_transcripts")
        .select("source, turns, full_text, created_at")
        .eq("call_sid", data.callSid)
        .order("created_at", { ascending: true }),
    ]);
    return { intelligence: intel ?? null, transcripts: transcripts ?? [] };
  });

/** Free-text search across summaries and transcripts. */
export const searchConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { q: string }) => input)
  .handler(async ({ context, data }) => {
    const term = data.q.trim();
    if (term.length < 2) return [];
    const like = `%${term}%`;

    const [{ data: intel }, { data: transcripts }] = await Promise.all([
      context.supabase
        .from("call_intelligence")
        .select("call_sid, summary, intent, contact_number, created_at")
        .or(`summary.ilike.${like},intent.ilike.${like}`)
        .order("created_at", { ascending: false })
        .limit(40),
      context.supabase
        .from("call_transcripts")
        .select("call_sid, full_text, contact_number, created_at")
        .ilike("full_text", like)
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

    const seen = new Set<string>();
    const out: Array<{
      callSid: string;
      line: string;
      contactNumber: string | null;
      at: string;
    }> = [];

    for (const row of intel ?? []) {
      const sid = row.call_sid as string;
      if (seen.has(sid)) continue;
      seen.add(sid);
      out.push({
        callSid: sid,
        line: (row.summary as string | null) ?? (row.intent as string | null) ?? "",
        contactNumber: (row.contact_number as string | null) ?? null,
        at: row.created_at as string,
      });
    }
    for (const row of transcripts ?? []) {
      const sid = row.call_sid as string;
      if (seen.has(sid)) continue;
      seen.add(sid);
      const text = (row.full_text as string) ?? "";
      const index = text.toLowerCase().indexOf(term.toLowerCase());
      out.push({
        callSid: sid,
        line: text.slice(Math.max(0, index - 60), Math.max(0, index - 60) + 180),
        contactNumber: (row.contact_number as string | null) ?? null,
        at: row.created_at as string,
      });
    }
    return out.slice(0, 40);
  });

/** Re-run the AI pass for one call, on demand. */
export const reanalyseCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { callSid: string }) => input)
  .handler(async ({ context, data }) => {
    const { data: transcripts } = await context.supabase
      .from("call_transcripts")
      .select("full_text, app_number, contact_number")
      .eq("call_sid", data.callSid);

    const text = (transcripts ?? []).map((row) => row.full_text as string).join("\n").trim();
    if (!text) {
      const { data: call } = await context.supabase
        .from("calls")
        .select("transcription")
        .eq("sid", data.callSid)
        .maybeSingle();
      if (!call?.transcription) {
        throw new Error("There is no transcript for this call yet.");
      }
    }

    const { data: call } = await context.supabase
      .from("calls")
      .select("transcription, app_number, from_number, to_number, direction")
      .eq("sid", data.callSid)
      .maybeSingle();

    const { runCallIntelligence, AiUnavailable } = await import("./intelligence.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const first = (transcripts ?? [])[0];
    const contactNumber =
      (first?.contact_number as string | null) ??
      (call?.direction === "inbound"
        ? ((call?.from_number as string | null) ?? null)
        : ((call?.to_number as string | null) ?? null));

    try {
      const analysis = await runCallIntelligence(supabaseAdmin as never, {
        userId: context.userId,
        callSid: data.callSid,
        text: text || ((call?.transcription as string | null) ?? ""),
        appNumber: (first?.app_number as string | null) ?? (call?.app_number as string | null),
        contactNumber,
        ...(call?.direction ? { direction: call.direction as string } : {}),
      });
      if (!analysis) throw new Error("That call is too short to summarise.");
      return analysis;
    } catch (error) {
      if (error instanceof AiUnavailable) throw new Error(error.message);
      throw error;
    }
  });

/** What we remember about a caller, for the pre-call context card. */
export const getContactMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { contactNumber: string }) => input)
  .handler(async ({ context, data }) => {
    const [{ data: memory }, { data: rule }] = await Promise.all([
      context.supabase
        .from("contact_memory")
        .select("rolling_summary, last_call_at, call_count")
        .eq("user_id", context.userId)
        .eq("contact_number", data.contactNumber)
        .maybeSingle(),
      context.supabase
        .from("caller_rules")
        .select("behavior, label")
        .eq("user_id", context.userId)
        .eq("contact_number", data.contactNumber)
        .maybeSingle(),
    ]);
    return { memory: memory ?? null, rule: rule ?? null };
  });

export const listCallerRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("caller_rules")
      .select("id, contact_number, label, behavior")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const saveCallerRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { contactNumber: string; behavior: "vip" | "screen" | "block"; label?: string }) =>
      input,
  )
  .handler(async ({ context, data }) => {
    const number = data.contactNumber.trim();
    if (!number) throw new Error("Enter a phone number first.");
    const { error } = await context.supabase.from("caller_rules").upsert(
      {
        user_id: context.userId,
        contact_number: number,
        behavior: data.behavior,
        label: data.label?.trim() || null,
      },
      { onConflict: "user_id,contact_number" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCallerRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("caller_rules")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAssistantSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select("transcribe_calls, assistant_instructions, digest_enabled")
      .eq("id", context.userId)
      .maybeSingle();
    return {
      transcribeCalls: Boolean(data?.transcribe_calls),
      assistantInstructions: (data?.assistant_instructions as string | null) ?? "",
      digestEnabled: Boolean(data?.digest_enabled),
    };
  });

export const saveAssistantSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      transcribeCalls?: boolean;
      assistantInstructions?: string;
      digestEnabled?: boolean;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const patch: {
      transcribe_calls?: boolean;
      digest_enabled?: boolean;
      assistant_instructions?: string | null;
    } = {};
    if (typeof data.transcribeCalls === "boolean") patch["transcribe_calls"] = data.transcribeCalls;
    if (typeof data.digestEnabled === "boolean") patch["digest_enabled"] = data.digestEnabled;
    if (typeof data.assistantInstructions === "string") {
      patch["assistant_instructions"] = data.assistantInstructions.slice(0, 2000) || null;
    }
    if (!Object.keys(patch).length) return { ok: true };
    const { error } = await context.supabase
      .from("profiles")
      .update(patch)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Weekly view: volumes, response behaviour and what people call about. */
export const getInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();

    const [{ data: calls }, { data: intel }] = await Promise.all([
      context.supabase
        .from("calls")
        .select("direction, status, duration, started_at, answered_in_app")
        .gte("started_at", since)
        .limit(1000),
      context.supabase
        .from("call_intelligence")
        .select("intent, sentiment, urgency, created_at")
        .gte("created_at", since)
        .limit(1000),
    ]);

    const rows = calls ?? [];
    const inbound = rows.filter((r) => r.direction === "inbound");
    const missedStatuses = ["no-answer", "busy", "failed", "canceled"];
    const missed = inbound.filter((r) => missedStatuses.includes((r.status ?? "").toLowerCase()));

    const byHour = new Array<number>(24).fill(0);
    for (const row of inbound) byHour[new Date(row.started_at as string).getHours()]! += 1;
    const afterHours = inbound.filter((row) => {
      const hour = new Date(row.started_at as string).getHours();
      return hour < 8 || hour >= 18;
    }).length;

    const intents = new Map<string, number>();
    for (const row of intel ?? []) {
      const key = ((row.intent as string | null) ?? "").trim().toLowerCase();
      if (key) intents.set(key, (intents.get(key) ?? 0) + 1);
    }

    const sentiment = { positive: 0, neutral: 0, negative: 0 };
    for (const row of intel ?? []) {
      const key = (row.sentiment as keyof typeof sentiment | null) ?? "neutral";
      if (key in sentiment) sentiment[key] += 1;
    }

    return {
      total: rows.length,
      inbound: inbound.length,
      outbound: rows.length - inbound.length,
      missed: missed.length,
      answeredInApp: rows.filter((r) => r.answered_in_app).length,
      talkMinutes: Math.round(
        rows.reduce((sum, r) => sum + ((r.duration as number | null) ?? 0), 0) / 60,
      ),
      afterHours,
      analysed: (intel ?? []).length,
      urgent: (intel ?? []).filter((r) => r.urgency === "high").length,
      sentiment,
      byHour,
      topIntents: [...intents.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([label, count]) => ({ label, count })),
    };
  });

/** Run one suggested follow-up. Everything reuses existing app plumbing. */
export const applySuggestedAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      kind: string;
      value?: string;
      contactNumber?: string;
      appNumber?: string;
      callSid?: string;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    if (data.kind === "save_contact") {
      if (!data.contactNumber) throw new Error("No number to save.");
      const { error } = await context.supabase.from("contacts").upsert(
        {
          phone_number: data.contactNumber,
          name: data.value || null,
          owner_id: context.userId,
        },
        { onConflict: "phone_number" },
      );
      if (error) throw new Error(error.message);
      return { ok: true, message: "Contact saved." };
    }

    if (data.kind === "note") {
      if (!data.contactNumber) throw new Error("No caller to attach that to.");
      const { rememberContact } = await import("./intelligence.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await rememberContact(
        supabaseAdmin as never,
        context.userId,
        data.contactNumber,
        data.value ?? "",
      );
      return { ok: true, message: "Saved to this caller's history." };
    }

    if (data.kind === "send_sms") {
      if (!data.contactNumber || !data.appNumber) throw new Error("Pick a line to text from.");
      const ops = await import("./twilio-ops.server");
      await ops.sendMessage(context.supabase as never, context.userId, {
        appNumber: data.appNumber,
        to: data.contactNumber,
        body: data.value ?? "",
        channel: "sms",
      });
      return { ok: true, message: "Message sent." };
    }

    if (data.kind === "save_place") {
      const { error } = await context.supabase.from("saved_places").insert({
        user_id: context.userId,
        nickname: data.value?.slice(0, 40) || "Saved from a call",
        label: "other",
        address: data.value ?? "",
      });
      if (error) throw new Error(error.message);
      return { ok: true, message: "Address saved." };
    }

    throw new Error("That follow-up has to be done from its own screen.");
  });