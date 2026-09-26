/**
 * Records why an inbound carrier webhook failed, so an admin can read the real
 * error instead of the caller's generic "an application error has occurred".
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { twilioRequest } from "./twilio.server";

export type WebhookErrorInput = {
  source?: string;
  errorCode?: string | null;
  message?: string | null;
  url?: string | null;
  callSid?: string | null;
  appNumber?: string | null;
  payload?: unknown;
  /** Owning workspace, already resolved from a number or member. Never a client id. */
  workspaceId?: string | null;
};

export async function logWebhookError(
  admin: SupabaseClient,
  input: WebhookErrorInput,
): Promise<void> {
  try {
    let workspaceId = input.workspaceId ?? null;
    if (!workspaceId && input.appNumber) {
      const { resolveWorkspaceIdForNumber } = await import("./workspace.server");
      workspaceId = (await resolveWorkspaceIdForNumber(input.appNumber)).workspaceId;
    }
    const { error } = await admin.from("webhook_errors").insert({
      source: input.source ?? "twilio",
      error_code: input.errorCode ?? null,
      message: input.message ? String(input.message).slice(0, 2000) : null,
      url: input.url ?? null,
      call_sid: input.callSid ?? null,
      app_number: input.appNumber ?? null,
      payload: (input.payload ?? {}) as never,
      ...(workspaceId ? { workspace_id: workspaceId } : {}),
    });
    if (error) console.error("Failed to record webhook error", error.message);
  } catch (error) {
    console.error("Failed to record webhook error", error);
  }
}

export type TwilioAlert = {
  sid: string;
  errorCode: string | null;
  logLevel: string | null;
  message: string | null;
  requestUrl: string | null;
  callSid: string | null;
  moreInfo: string | null;
  createdAt: string | null;
};

function fieldFromText(text: string | null | undefined, key: string): string | null {
  if (!text) return null;
  const params = new URLSearchParams(text.replace(/^\?/, ""));
  return params.get(key);
}

/** Most recent Twilio Debugger alerts for this account (read-only). */
export async function recentTwilioAlerts(limit = 20): Promise<TwilioAlert[]> {
  const data = await twilioRequest<{ alerts?: Record<string, unknown>[] }>({
    host: "monitor",
    path: "/v1/Alerts",
    params: { PageSize: Math.min(limit, 50) },
  });
  const alerts = Array.isArray(data.alerts) ? data.alerts : [];
  return alerts.slice(0, limit).map((raw) => {
    const text = typeof raw["alert_text"] === "string" ? (raw["alert_text"] as string) : null;
    return {
      sid: String(raw["sid"] ?? ""),
      errorCode: raw["error_code"] ? String(raw["error_code"]) : null,
      logLevel: raw["log_level"] ? String(raw["log_level"]) : null,
      message: fieldFromText(text, "Msg") ?? fieldFromText(text, "ErrorCode") ?? text,
      requestUrl: raw["request_url"] ? String(raw["request_url"]) : null,
      callSid: raw["resource_sid"] ? String(raw["resource_sid"]) : null,
      moreInfo: raw["more_info"] ? String(raw["more_info"]) : null,
      createdAt: raw["date_created"] ? String(raw["date_created"]) : null,
    };
  });
}
