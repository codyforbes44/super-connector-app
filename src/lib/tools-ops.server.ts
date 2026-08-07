import type { SupabaseClient } from "@supabase/supabase-js";

import { requireAdmin } from "./app.server";
import { FROM_ALERTS, sendEmail } from "./email.server";
import type { TemplateName } from "./email-templates/index";
import { applyOverride, TEMPLATE_CATALOG, type TemplateOverride } from "./email-templates/overrides";
import * as maps from "./maps.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

/* ------------------------------------------------------------ places */

type CacheEntry = { at: number; results: maps.PlaceResult[] };
const placeCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000;

export async function fastPlaces(supabase: SupabaseClient, userId: string, query: string) {
  const q = query.trim();
  if (q.length < 2) return { connected: maps.mapsConfigured(), results: [], cached: false };
  if (!maps.mapsConfigured()) return { connected: false, results: [], cached: false };

  const key = q.toLowerCase();
  const hit = placeCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) {
    return { connected: true, results: hit.results, cached: true };
  }

  const results = await maps.searchPlaces(q);
  placeCache.set(key, { at: Date.now(), results });
  if (placeCache.size > 200) {
    const oldest = placeCache.keys().next().value;
    if (oldest) placeCache.delete(oldest);
  }

  void supabase.from("place_searches").insert({ user_id: userId, query: q });
  return { connected: true, results, cached: false };
}

export async function recentSearches(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("place_searches")
    .select("query, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  const seen = new Set<string>();
  return (data ?? [])
    .filter((r) => {
      const q = (r.query as string).toLowerCase();
      if (seen.has(q)) return false;
      seen.add(q);
      return true;
    })
    .slice(0, 6);
}

export type SavedPlaceInput = {
  id?: string;
  nickname: string;
  label?: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
  phone?: string;
  notes?: string;
};

export async function listSavedPlaces(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("saved_places")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function saveFavoritePlace(
  supabase: SupabaseClient,
  userId: string,
  input: SavedPlaceInput,
) {
  const row = {
    user_id: userId,
    nickname: input.nickname,
    label: input.label ?? "other",
    name: input.name,
    address: input.address,
    lat: input.lat,
    lng: input.lng,
    place_id: input.placeId ?? null,
    phone: input.phone ?? null,
    notes: input.notes ?? null,
    updated_at: new Date().toISOString(),
  };
  const query = input.id
    ? supabase.from("saved_places").update(row).eq("id", input.id).eq("user_id", userId)
    : supabase.from("saved_places").insert(row);
  const { error } = await query;
  if (error) throw error;
  return { ok: true };
}

export async function deleteFavoritePlace(supabase: SupabaseClient, userId: string, id: string) {
  const { error } = await supabase.from("saved_places").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
  return { ok: true };
}

/* --------------------------------------------------- email analytics */

export type DeliveryRow = {
  id: string;
  template: string;
  to_address: string;
  subject: string;
  status: string;
  error: string | null;
  created_at: string;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  last_event_at: string | null;
  open_count: number;
  click_count: number;
  retry_of: string | null;
};

export async function emailDeliveries(
  supabase: SupabaseClient,
  userId: string,
  filter: { status?: string; recipient?: string; limit?: number },
) {
  await requireAdmin(supabase, userId);
  const db = await admin();
  let query = db
    .from("email_log")
    .select(
      "id, template, to_address, subject, status, error, created_at, delivered_at, opened_at, clicked_at, bounced_at, complained_at, last_event_at, open_count, click_count, retry_of",
    )
    .order("created_at", { ascending: false })
    .limit(filter.limit ?? 50);
  if (filter.status && filter.status !== "all") query = query.eq("status", filter.status);
  if (filter.recipient) query = query.ilike("to_address", `%${filter.recipient}%`);
  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as DeliveryRow[];
  const stats = {
    total: rows.length,
    sent: rows.filter((r) => r.status === "sent" || r.status === "delivered").length,
    delivered: rows.filter((r) => Boolean(r.delivered_at)).length,
    opened: rows.filter((r) => Boolean(r.opened_at)).length,
    clicked: rows.filter((r) => Boolean(r.clicked_at)).length,
    failed: rows.filter((r) => r.status === "failed" || r.status === "bounced").length,
  };
  return { rows, stats };
}

export async function emailDetail(supabase: SupabaseClient, userId: string, id: string) {
  await requireAdmin(supabase, userId);
  const db = await admin();
  const { data, error } = await db.from("email_log").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function retryEmail(supabase: SupabaseClient, userId: string, id: string) {
  await requireAdmin(supabase, userId);
  const db = await admin();
  const { data } = await db
    .from("email_log")
    .select("id, template, to_address, subject, body_html")
    .eq("id", id)
    .maybeSingle();
  if (!data) throw new Error("Email not found.");
  if (!data.body_html) throw new Error("No stored copy for this email — send it again from source.");

  const result = await sendEmail(db, {
    to: (data.to_address as string).split(",").map((a) => a.trim()),
    template: data.template as TemplateName,
    rendered: { subject: data.subject as string, html: data.body_html as string },
    from: FROM_ALERTS,
    retryOf: data.id as string,
    context: { retry_of: data.id },
  });
  if (!result.sent) throw new Error(result.error ?? "Retry failed");
  return { ok: true };
}

/* -------------------------------------------------- template editing */

export async function listTemplateOverrides(supabase: SupabaseClient, userId: string) {
  await requireAdmin(supabase, userId);
  const { data } = await supabase.from("email_template_overrides").select("*");
  const byName = new Map((data ?? []).map((r) => [r.template as string, r as TemplateOverride]));
  return TEMPLATE_CATALOG.map((entry) => ({
    ...entry,
    override: byName.get(entry.template) ?? null,
  }));
}

export async function saveTemplateOverride(
  supabase: SupabaseClient,
  userId: string,
  input: {
    template: string;
    subject?: string | null;
    eyebrow?: string | null;
    headline?: string | null;
    intro?: string | null;
    outro?: string | null;
    enabled: boolean;
  },
) {
  await requireAdmin(supabase, userId);
  const { error } = await supabase.from("email_template_overrides").upsert(
    {
      template: input.template,
      subject: input.subject ?? null,
      eyebrow: input.eyebrow ?? null,
      headline: input.headline ?? null,
      intro: input.intro ?? null,
      outro: input.outro ?? null,
      enabled: input.enabled,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "template" },
  );
  if (error) throw error;
  return { ok: true };
}

/** Render a template with sample data + the draft override, for live preview. */
export async function previewTemplate(
  supabase: SupabaseClient,
  userId: string,
  input: {
    template: string;
    draft: {
      subject?: string | null;
      eyebrow?: string | null;
      headline?: string | null;
      intro?: string | null;
      outro?: string | null;
      enabled: boolean;
    };
  },
) {
  await requireAdmin(supabase, userId);
  const templates = await import("./email-templates/index");
  const { appBaseUrl } = await import("./email.server");
  const baseUrl = appBaseUrl();
  const vars: Record<string, unknown> = {
    from: "+1 415 555 0134",
    to: "+1 628 555 0110",
    at: new Date().toLocaleString(),
    duration: "0:42",
    channel: "SMS",
    preview: "Hey — are you around for a quick call?",
    summary: "Caller asked about pricing and booked a demo for Thursday.",
    displayName: "Cody",
    detail: "Your number +1 628 555 0110 is live.",
    rangeLabel: "today",
  };

  let rendered;
  switch (input.template) {
    case "missed-call":
      rendered = templates.missedCall({
        baseUrl,
        from: vars["from"] as string,
        to: vars["to"] as string,
        at: vars["at"] as string,
      });
      break;
    case "voicemail":
      rendered = templates.voicemail({
        baseUrl,
        from: vars["from"] as string,
        to: vars["to"] as string,
        at: vars["at"] as string,
        duration: vars["duration"] as string,
        transcript: "Hi, it's Sam — give me a ring back when you can.",
      });
      break;
    case "inbound-message":
      rendered = templates.inboundMessage({
        baseUrl,
        channel: "sms",
        from: vars["from"] as string,
        to: vars["to"] as string,
        at: vars["at"] as string,
        preview: vars["preview"] as string,
        conversationId: "preview",
      });
      break;
    case "ai-summary":
      rendered = templates.aiSummary({
        baseUrl,
        from: vars["from"] as string,
        to: vars["to"] as string,
        at: vars["at"] as string,
        summary: vars["summary"] as string,
        turns: [
          { role: "agent", message: "Thanks for calling SixVox, how can I help?" },
          { role: "caller", message: "I'd like to book a demo." },
        ],
      });
      break;
    case "daily-digest":
      rendered = templates.dailyDigest({
        baseUrl,
        rangeLabel: vars["rangeLabel"] as string,
        threads: [
          { from: vars["from"] as string, preview: vars["preview"] as string, id: "preview" },
        ],
        calls: [{ from: vars["from"] as string, at: vars["at"] as string, kind: "missed" }],
      });
      break;
    case "test":
      rendered = templates.testEmail(baseUrl);
      break;
    default:
      rendered = templates.account({
        baseUrl,
        kind: "welcome",
        displayName: vars["displayName"] as string,
        detail: vars["detail"] as string,
      });
  }

  const override: TemplateOverride = {
    template: input.template,
    subject: input.draft.subject ?? null,
    eyebrow: input.draft.eyebrow ?? null,
    headline: input.draft.headline ?? null,
    intro: input.draft.intro ?? null,
    outro: input.draft.outro ?? null,
    enabled: input.draft.enabled,
  };
  return applyOverride(rendered, override, vars);
}

/* -------------------------------------------------- calendar settings */

export type CalendarSettingsInput = {
  activeCalendars: string[];
  defaultCalendarId: string;
  timezone: string;
  lookbackDays: number;
  lookaheadDays: number;
  eventTitleTemplate: string;
  defaultDurationMinutes: number;
  bufferMinutes: number;
  inviteContact: boolean;
  addMeetLink: boolean;
  aiEventStatus: string;
};

export async function getCalendarSettings(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("calendar_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}

export async function saveCalendarSettings(
  supabase: SupabaseClient,
  userId: string,
  input: CalendarSettingsInput,
) {
  const { error } = await supabase.from("calendar_settings").upsert(
    {
      user_id: userId,
      active_calendars: input.activeCalendars,
      default_calendar_id: input.defaultCalendarId,
      timezone: input.timezone,
      lookback_days: input.lookbackDays,
      lookahead_days: input.lookaheadDays,
      event_title_template: input.eventTitleTemplate,
      default_duration_minutes: input.defaultDurationMinutes,
      buffer_minutes: input.bufferMinutes,
      invite_contact: input.inviteContact,
      add_meet_link: input.addMeetLink,
      ai_event_status: input.aiEventStatus,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
  return { ok: true };
}