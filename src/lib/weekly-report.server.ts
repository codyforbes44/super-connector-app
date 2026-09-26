import type { SupabaseClient } from "@supabase/supabase-js";

import { appBaseUrl, sendEmail } from "./email.server";
import { weeklyMissed, type WeeklyMissedData } from "./email-templates/index";

export type WeeklyReport = WeeklyMissedData;

function weekAgo(): string {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

/** Calls the owner did not answer, plus jobs booked from those lines. */
export async function buildWeeklyReport(
  admin: SupabaseClient,
  userId: string,
): Promise<WeeklyReport> {
  const since = weekAgo();
  const { data: numbers } = await admin
    .from("phone_numbers")
    .select("phone_number")
    .eq("assigned_to", userId);
  const lines = (numbers ?? []).map((row) => row.phone_number as string);
  if (!lines.length) {
    return { baseUrl: appBaseUrl(), rangeLabel: "this week", missed: [], booked: [] };
  }

  const [{ data: calls }, { data: intel }, { data: bookings }] = await Promise.all([
    admin
      .from("calls")
      .select(
        "sid, from_number, status, started_at, answered_in_app, answer_path, recording_url, spam_action",
      )
      .in("app_number", lines)
      .eq("direction", "inbound")
      .gte("started_at", since)
      .limit(80),
    admin
      .from("call_intelligence")
      .select("call_sid, summary")
      .eq("user_id", userId)
      .gte("created_at", since)
      .limit(80),
    admin
      .from("calendar_bookings")
      .select("summary, starts_at, contact_number, status")
      .in("app_number", lines)
      .gte("starts_at", since)
      .limit(40),
  ]);

  const summaryBySid = new Map(
    (intel ?? []).map((row) => [row.call_sid as string, (row.summary as string) ?? ""]),
  );
  const missed = (calls ?? [])
    .filter((call) => call.spam_action !== "block" && call.answered_in_app !== true)
    .filter((call) => {
      const status = String(call.status ?? "").toLowerCase();
      return (
        ["no-answer", "busy", "failed", "canceled"].includes(status) ||
        call.answer_path === "ai_agent" ||
        Boolean(call.recording_url)
      );
    })
    .map((call) => ({
      from: call.from_number as string,
      at: new Date(call.started_at as string).toUTCString(),
      summary:
        summaryBySid.get(call.sid as string) || (call.recording_url ? "Voicemail" : "Missed call"),
    }));

  const booked = (bookings ?? [])
    .filter((row) => row.status !== "cancelled")
    .map((row) => ({
      summary: (row.summary as string) || "Booked job",
      when: new Date(row.starts_at as string).toUTCString(),
      contact: (row.contact_number as string) || "Customer",
    }));

  return { baseUrl: appBaseUrl(), rangeLabel: "this week", missed, booked };
}

export async function sendWeeklyReport(
  admin: SupabaseClient,
  userId: string,
  to: string,
): Promise<{ sent: boolean; error?: string }> {
  const report = await buildWeeklyReport(admin, userId);
  const result = await sendEmail(admin, {
    to,
    template: "weekly-missed",
    rendered: weeklyMissed(report),
    context: { userId, missed: report.missed.length, booked: report.booked.length },
  });
  return result.sent
    ? { sent: true }
    : { sent: false, ...(result.error ? { error: result.error } : {}) };
}

/** Weekly cron: one "calls you would have missed" email per line owner. */
export async function runWeeklyReports(
  admin: SupabaseClient,
): Promise<{ considered: number; sent: number }> {
  const { data: numbers } = await admin
    .from("phone_numbers")
    .select("assigned_to")
    .not("assigned_to", "is", null);
  const userIds = [
    ...new Set((numbers ?? []).map((row) => row.assigned_to as string).filter(Boolean)),
  ];
  let sent = 0;
  for (const userId of userIds) {
    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle();
    const to = profile?.email as string | null;
    if (!to) continue;
    const result = await sendWeeklyReport(admin, userId, to);
    if (result.sent) sent += 1;
  }
  return { considered: userIds.length, sent };
}
