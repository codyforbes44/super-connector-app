/**
 * Daily digest: a once-a-day rollup of everything that happened on a user's
 * lines. Also the delivery path for people who chose "digest" instead of
 * instant email alerts — their queued events are folded in here.
 * Server-only.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { appBaseUrl, sendEmail } from "./email.server";
import * as templates from "./email-templates/index";

export type DigestResult = { sent: boolean; reason?: string; threads: number; calls: number };

function hourInZone(timezone: string, now: Date): number {
  try {
    return Number(
      new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        hour12: false,
        timeZone: timezone || "UTC",
      }).format(now),
    );
  } catch {
    return now.getUTCHours();
  }
}

async function numbersForUser(admin: SupabaseClient, userId: string): Promise<string[]> {
  const { data } = await admin
    .from("phone_numbers")
    .select("phone_number")
    .eq("assigned_to", userId);
  return (data ?? []).map((row) => row["phone_number"] as string);
}

/** Everything worth reporting on for one user over the trailing window. */
export async function buildDigest(
  admin: SupabaseClient,
  userId: string,
  sinceIso: string,
): Promise<{ threads: templates.DigestData["threads"]; calls: templates.DigestData["calls"] }> {
  const numbers = await numbersForUser(admin, userId);
  if (!numbers.length) return { threads: [], calls: [] };

  const [{ data: convos }, { data: calls }, { data: intel }] = await Promise.all([
    admin
      .from("conversations")
      .select("id, contact_name, contact_number, last_message_preview, unread_count, last_message_at")
      .in("app_number", numbers)
      .gt("unread_count", 0)
      .gte("last_message_at", sinceIso)
      .order("last_message_at", { ascending: false })
      .limit(20),
    admin
      .from("calls")
      .select("sid, from_number, status, started_at, recording_url, direction")
      .in("app_number", numbers)
      .eq("direction", "inbound")
      .gte("started_at", sinceIso)
      .order("started_at", { ascending: false })
      .limit(40),
    admin
      .from("call_intelligence")
      .select("call_sid, summary")
      .eq("user_id", userId)
      .gte("created_at", sinceIso)
      .limit(40),
  ]);

  const summaryBySid = new Map(
    (intel ?? []).map((row) => [row["call_sid"] as string, (row["summary"] as string) ?? ""]),
  );

  const threads = (convos ?? []).map((c) => ({
    from: (c["contact_name"] as string | null) || (c["contact_number"] as string),
    preview: (c["last_message_preview"] as string | null) ?? "New message",
    id: c["id"] as string,
  }));

  const missedStatuses = new Set(["no-answer", "busy", "failed", "canceled"]);
  const callRows = (calls ?? [])
    .filter(
      (c) =>
        missedStatuses.has(String(c["status"] ?? "").toLowerCase()) ||
        Boolean(c["recording_url"]) ||
        summaryBySid.has(c["sid"] as string),
    )
    .map((c) => {
      const summary = summaryBySid.get(c["sid"] as string);
      const kind = summary
        ? summary.slice(0, 90)
        : c["recording_url"]
          ? "voicemail"
          : "missed call";
      return {
        from: c["from_number"] as string,
        at: new Date(c["started_at"] as string).toUTCString(),
        kind,
      };
    });

  return { threads, calls: callRows };
}

/** Queue an alert for someone who receives digests instead of instant email. */
export async function queueDigestEvent(
  admin: SupabaseClient,
  userId: string,
  kind: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await admin.from("digest_queue").insert({ user_id: userId, kind, payload });
  } catch (error) {
    console.error("digest queue insert failed", error);
  }
}

/** Build and send one user's digest. Nothing to report means no email. */
export async function sendDigestForUser(
  admin: SupabaseClient,
  userId: string,
  opts: { force?: boolean } = {},
): Promise<DigestResult> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { threads, calls } = await buildDigest(admin, userId, since);

  const { data: queued } = await admin
    .from("digest_queue")
    .select("id, kind, payload")
    .eq("user_id", userId)
    .eq("sent", false)
    .order("created_at", { ascending: false })
    .limit(50);

  // Queued instant-alerts that were held back become digest rows so nothing
  // silently disappears for people in digest mode.
  const extraCalls = (queued ?? [])
    .filter((row) => row["kind"] !== "message")
    .map((row) => {
      const p = (row["payload"] ?? {}) as Record<string, unknown>;
      return {
        from: String(p["from"] ?? "Unknown"),
        at: String(p["at"] ?? new Date().toUTCString()),
        kind: String(row["kind"] ?? "alert").replace(/_/g, " "),
      };
    });
  const extraThreads = (queued ?? [])
    .filter((row) => row["kind"] === "message")
    .map((row) => {
      const p = (row["payload"] ?? {}) as Record<string, unknown>;
      return {
        from: String(p["from"] ?? "Unknown"),
        preview: String(p["preview"] ?? "New message"),
        id: String(p["conversationId"] ?? ""),
      };
    });

  const allThreads = [...threads, ...extraThreads].slice(0, 25);
  const allCalls = [...calls, ...extraCalls].slice(0, 25);

  if (!allThreads.length && !allCalls.length && !opts.force) {
    await admin
      .from("profiles")
      .update({ last_digest_sent_at: new Date().toISOString() })
      .eq("id", userId);
    return { sent: false, reason: "nothing to report", threads: 0, calls: 0 };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  const { data: prefs } = await admin
    .from("notification_prefs")
    .select("email_address")
    .eq("user_id", userId)
    .maybeSingle();

  const to = ((prefs?.["email_address"] as string | null) ||
    (profile?.["email"] as string | null) ||
    "") as string;
  if (!to) return { sent: false, reason: "no email address", threads: 0, calls: 0 };

  const result = await sendEmail(admin, {
    to,
    template: "daily-digest",
    rendered: templates.dailyDigest({
      baseUrl: appBaseUrl(),
      rangeLabel: "in the last 24 hours",
      threads: allThreads,
      calls: allCalls,
    }),
    context: { digest: true, threads: allThreads.length, calls: allCalls.length },
  });

  if (result.sent) {
    const ids = (queued ?? []).map((row) => row["id"] as string);
    if (ids.length) await admin.from("digest_queue").update({ sent: true }).in("id", ids);
    await admin
      .from("profiles")
      .update({ last_digest_sent_at: new Date().toISOString() })
      .eq("id", userId);
  }

  return {
    sent: result.sent,
    ...(result.error ? { reason: result.error } : {}),
    threads: allThreads.length,
    calls: allCalls.length,
  };
}

/**
 * Hourly entry point: send to everyone whose local digest hour is now and who
 * has not already received one in the last 20 hours.
 */
export async function runDueDigests(admin: SupabaseClient): Promise<{
  considered: number;
  sent: number;
}> {
  const now = new Date();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, digest_enabled, digest_hour, last_digest_sent_at")
    .eq("digest_enabled", true);

  const rows = profiles ?? [];
  if (!rows.length) return { considered: 0, sent: 0 };

  const { data: prefs } = await admin
    .from("notification_prefs")
    .select("user_id, timezone")
    .in(
      "user_id",
      rows.map((r) => r["id"] as string),
    );
  const zoneByUser = new Map(
    (prefs ?? []).map((p) => [p["user_id"] as string, (p["timezone"] as string) || "UTC"]),
  );

  let sent = 0;
  for (const row of rows) {
    const userId = row["id"] as string;
    const targetHour = (row["digest_hour"] as number | null) ?? 8;
    if (hourInZone(zoneByUser.get(userId) ?? "UTC", now) !== targetHour) continue;

    const last = row["last_digest_sent_at"] as string | null;
    if (last && Date.now() - new Date(last).getTime() < 20 * 60 * 60 * 1000) continue;

    try {
      const result = await sendDigestForUser(admin, userId);
      if (result.sent) sent += 1;
    } catch (error) {
      console.error("digest send failed", userId, error);
    }
  }

  return { considered: rows.length, sent };
}