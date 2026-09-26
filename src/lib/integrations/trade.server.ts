import type { SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";

import type { Database } from "@/integrations/supabase/types";
import { PUBLIC_BASE_URL, allowedNumbers } from "../app.server";
import { decryptConnectionKey, encryptConnectionKey } from "../connection-key-crypto.server";
import { loadAutomatedTextDeps } from "@/lib/automated-text.server";
import { messagingStateFor } from "../messaging.server";
import { normalizePhone } from "../twilio.server";
import { sendAutomatedText } from "./automated-text.server";
import { REGISTERED_TEXTING_E164, paymentLinkBody, canSendAutomatedText } from "./automated-text";
import {
  HOUSECALL_API_BASE,
  HOUSECALL_MAX_PLAN_COPY,
  buildHousecallCustomer,
  buildHousecallLead,
  type HousecallCallInput,
} from "./housecall";
import {
  createJobberGraphql,
  createPkcePair,
  exchangeJobberCode,
  jobberAuthorizeUrl,
  syncCallToJobber,
  type JobberCallInput,
} from "./jobber";
import {
  applyPortWebhook as nextPortStatus,
  forwardingRemainsDefault,
  parsePortWebhookStatus,
  preparePortDraft,
  runPortSubmission,
  type PortDraft,
  type PortStatus,
} from "./port-in";
import { consentActionFor, decideReviewRequest } from "./reviews";
import {
  accountOnboardingLinkParams,
  assertConnectTestKey,
  cardPaymentsActive,
  cardPaymentsStatus,
  directChargeCheckoutParams,
  formatUsd,
  interpretConnectEvent,
  merchantAccountParams,
  parseAmountToCents,
} from "./stripe-connect";

type SB = SupabaseClient<Database>;
type Row = Record<string, unknown>;

type LooseResult = Promise<{ data: Row | null; error: { message: string } | null }>;

type LooseQuery = {
  select: (columns?: string) => LooseQuery;
  insert: (value: Row | Row[]) => LooseQuery & LooseResult;
  update: (value: Row) => LooseQuery & LooseResult;
  delete: () => LooseQuery & LooseResult;
  upsert: (value: Row, options?: { onConflict?: string }) => LooseQuery & LooseResult;
  eq: (column: string, value: unknown) => LooseQuery;
  is: (column: string, value: null) => LooseQuery;
  order: (column: string, options?: { ascending?: boolean }) => LooseQuery;
  limit: (count: number) => LooseQuery;
  maybeSingle: () => Promise<{ data: Row | null; error: { message: string } | null }>;
  single: () => Promise<{ data: Row | null; error: { message: string } | null }>;
};

function db(admin: SB) {
  return admin as unknown as { from: (table: string) => LooseQuery };
}

async function adminClient(): Promise<SB> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** The session's workspace. Never trust a client id. */
export async function resolveWorkspaceId(userId: string): Promise<string | null> {
  const { resolveWorkspaceForUser } = await import("../workspace.server");
  const workspace = await resolveWorkspaceForUser(userId);
  return workspace?.id ?? null;
}

function must(error: { message: string } | null, data: Row | null, label: string): Row {
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`${label} was not saved.`);
  return data;
}

async function connectionFor(admin: SB, userId: string, provider: string): Promise<Row | null> {
  const { data, error } = await db(admin)
    .from("integration_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function saveSecret(
  admin: SB,
  connectionId: string,
  secret: { access?: string | null; refresh?: string | null; apiKey?: string | null },
) {
  const row: Row = { connection_id: connectionId, updated_at: new Date().toISOString() };
  if (secret.access !== undefined) {
    row["access_token_ciphertext"] = secret.access ? encryptConnectionKey(secret.access) : null;
  }
  if (secret.refresh !== undefined) {
    row["refresh_token_ciphertext"] = secret.refresh ? encryptConnectionKey(secret.refresh) : null;
  }
  if (secret.apiKey !== undefined) {
    row["api_key_ciphertext"] = secret.apiKey ? encryptConnectionKey(secret.apiKey) : null;
  }
  const { error } = await db(admin)
    .from("integration_secrets")
    .upsert(row, { onConflict: "connection_id" });
  if (error) throw new Error(error.message);
}

async function readSecret(admin: SB, connectionId: string): Promise<Row | null> {
  const { data, error } = await db(admin)
    .from("integration_secrets")
    .select("*")
    .eq("connection_id", connectionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

function decryptField(row: Row | null, field: string): string | null {
  const value = row?.[field];
  if (typeof value !== "string" || !value) return null;
  return decryptConnectionKey(value);
}

async function upsertConnection(
  admin: SB,
  userId: string,
  provider: string,
  patch: Row,
): Promise<Row> {
  const workspaceId = await resolveWorkspaceId(userId);
  const existing = await connectionFor(admin, userId, provider);
  if (existing) {
    const { data, error } = await db(admin)
      .from("integration_connections")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", existing["id"])
      .select("*")
      .single();
    return must(error, data, "Connection");
  }
  const { data, error } = await db(admin)
    .from("integration_connections")
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
      provider,
      status: "disconnected",
      ...patch,
    })
    .select("*")
    .single();
  return must(error, data, "Connection");
}

function jobberConfigured(): boolean {
  return Boolean(process.env["JOBBER_CLIENT_ID"] && process.env["JOBBER_CLIENT_SECRET"]);
}

function connectConfigured(): boolean {
  try {
    assertConnectTestKey(process.env["STRIPE_CONNECT_SECRET_KEY"]);
    return true;
  } catch {
    return false;
  }
}

export async function integrationsOverview(supabase: SB, userId: string) {
  const admin = await adminClient();
  const [jobber, housecall, connect, reviews, port] = await Promise.all([
    connectionFor(admin, userId, "jobber"),
    connectionFor(admin, userId, "housecall_pro"),
    connectionFor(admin, userId, "stripe_connect"),
    db(admin).from("review_settings").select("*").eq("user_id", userId).maybeSingle(),
    db(admin)
      .from("port_in_requests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (reviews.error) throw new Error(reviews.error.message);
  if (port.error) throw new Error(port.error.message);
  const review = reviews.data;
  const latestPort = port.data;
  const portStatus = (latestPort?.["status"] as PortStatus | undefined) ?? null;
  const metadata = (connect?.["metadata"] as Row | undefined) ?? {};
  void supabase;
  return {
    registeredTextingNumber: REGISTERED_TEXTING_E164,
    jobber: {
      configured: jobberConfigured(),
      connected: jobber?.["status"] === "connected",
      accountName: (jobber?.["account_label"] as string | null) ?? null,
    },
    housecall: {
      connected: housecall?.["status"] === "connected",
      keyHint:
        ((housecall?.["metadata"] as Row | undefined)?.["key_hint"] as string | null) ?? null,
      maxPlanCopy: HOUSECALL_MAX_PLAN_COPY,
    },
    reviews: {
      reviewUrl: (review?.["google_review_url"] as string | null) ?? "",
      businessName: (review?.["business_name"] as string | null) ?? "",
      enabled: Boolean(review?.["enabled"]),
      cooldownDays: Number(review?.["cooldown_days"] ?? 90),
      quietStart: (review?.["quiet_start"] as string | undefined) ?? "21:00",
      quietEnd: (review?.["quiet_end"] as string | undefined) ?? "08:00",
      timezone: (review?.["timezone"] as string | undefined) ?? "America/Chicago",
    },
    connect: {
      configured: connectConfigured(),
      accountId: (connect?.["external_account_id"] as string | null) ?? null,
      cardPayments: (metadata["card_payments"] as string | undefined) ?? "unknown",
      chargesActive: metadata["card_payments"] === "active",
      label: (connect?.["account_label"] as string | null) ?? null,
    },
    port: latestPort
      ? {
          id: latestPort["id"] as string,
          status: portStatus,
          phoneNumber: latestPort["phone_number"] as string,
          accountLast4: (latestPort["account_last4"] as string | null) ?? null,
          rejectionReason: (latestPort["rejection_reason"] as string | null) ?? null,
          forwardingDefault: portStatus ? forwardingRemainsDefault(portStatus) : true,
          liveEnabled: process.env["PORT_IN_LIVE"] === "true",
        }
      : {
          id: null,
          status: null,
          phoneNumber: null,
          accountLast4: null,
          rejectionReason: null,
          forwardingDefault: true,
          liveEnabled: process.env["PORT_IN_LIVE"] === "true",
        },
  };
}

export async function startJobberConnect(userId: string, redirectUri: string) {
  const clientId = process.env["JOBBER_CLIENT_ID"];
  if (!clientId || !process.env["JOBBER_CLIENT_SECRET"]) {
    throw new Error("Jobber is not configured yet. Add JOBBER_CLIENT_ID and JOBBER_CLIENT_SECRET.");
  }
  const { verifier, challenge } = await createPkcePair();
  const state = crypto.randomUUID();
  const admin = await adminClient();
  const { error } = await db(admin)
    .from("oauth_transactions")
    .insert({
      user_id: userId,
      provider: "jobber",
      state,
      code_verifier_ciphertext: encryptConnectionKey(verifier),
      redirect_uri: redirectUri,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
  if (error) throw new Error(error.message);
  return {
    authorizationUrl: jobberAuthorizeUrl({
      clientId,
      redirectUri,
      state,
      codeChallenge: challenge,
    }),
  };
}

async function jobberAccessToken(admin: SB, userId: string): Promise<string> {
  const connection = await connectionFor(admin, userId, "jobber");
  if (!connection || connection["status"] !== "connected") {
    throw new Error("Connect Jobber first.");
  }
  const secret = await readSecret(admin, connection["id"] as string);
  let access = decryptField(secret, "access_token_ciphertext");
  const refresh = decryptField(secret, "refresh_token_ciphertext");
  const expires = connection["token_expires_at"]
    ? new Date(connection["token_expires_at"] as string).getTime()
    : 0;
  if (refresh && expires - Date.now() < 60_000) {
    const body = new URLSearchParams({
      client_id: process.env["JOBBER_CLIENT_ID"] ?? "",
      client_secret: process.env["JOBBER_CLIENT_SECRET"] ?? "",
      grant_type: "refresh_token",
      refresh_token: refresh,
    });
    const response = await fetch("https://api.getjobber.com/api/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
    };
    if (!response.ok || !json.access_token) {
      throw new Error(json.error || "Jobber refresh failed. Reconnect Jobber.");
    }
    access = json.access_token;
    await saveSecret(admin, connection["id"] as string, {
      access: json.access_token,
      refresh: json.refresh_token ?? refresh,
    });
    await db(admin)
      .from("integration_connections")
      .update({
        token_expires_at: new Date(Date.now() + (json.expires_in ?? 3600) * 1000).toISOString(),
      })
      .eq("id", connection["id"]);
  }
  if (!access) throw new Error("Jobber token is missing. Reconnect Jobber.");
  return access;
}

export async function completeJobberConnect(userId: string, code: string, state: string) {
  const admin = await adminClient();
  const { data: pending, error } = await db(admin)
    .from("oauth_transactions")
    .select("*")
    .eq("state", state)
    .eq("provider", "jobber")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!pending || pending["user_id"] !== userId)
    throw new Error("Jobber sign-in could not be verified.");
  if (new Date(pending["expires_at"] as string).getTime() < Date.now()) {
    throw new Error("Jobber sign-in expired. Try connecting again.");
  }
  const tokens = await exchangeJobberCode(fetch, {
    clientId: process.env["JOBBER_CLIENT_ID"] ?? "",
    clientSecret: process.env["JOBBER_CLIENT_SECRET"] ?? "",
    code,
    redirectUri: pending["redirect_uri"] as string,
    codeVerifier: decryptConnectionKey(pending["code_verifier_ciphertext"] as string),
  });
  const graphql = createJobberGraphql(fetch, tokens.access_token);
  const account = await graphql("query { account { id name } }", {});
  const accountNode = (account.data?.["account"] as Row | undefined) ?? {};
  const connection = await upsertConnection(admin, userId, "jobber", {
    status: "connected",
    external_account_id: (accountNode["id"] as string | undefined) ?? null,
    account_label: (accountNode["name"] as string | undefined) ?? "Jobber",
    token_expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
  });
  await saveSecret(admin, connection["id"] as string, {
    access: tokens.access_token,
    refresh: tokens.refresh_token ?? null,
  });
  await db(admin).from("oauth_transactions").delete().eq("id", pending["id"]);
  return { ok: true as const, accountName: (connection["account_label"] as string | null) ?? null };
}

export async function disconnectJobber(userId: string) {
  const admin = await adminClient();
  const connection = await connectionFor(admin, userId, "jobber");
  if (connection?.["status"] === "connected") {
    try {
      const token = await jobberAccessToken(admin, userId);
      const graphql = createJobberGraphql(fetch, token);
      await graphql("mutation { appDisconnect { app { name } userErrors { message } } }", {});
    } catch (error) {
      console.error("jobber appDisconnect failed", error);
    }
  }
  if (connection) {
    await db(admin).from("integration_secrets").delete().eq("connection_id", connection["id"]);
    await db(admin)
      .from("integration_connections")
      .update({
        status: "disconnected",
        external_account_id: null,
        account_label: null,
        token_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection["id"]);
  }
  return { ok: true as const };
}

export type TradeCallFields = {
  conversationId?: string | null;
  leadId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  summary?: string | null;
};

async function tradeContext(supabase: SB, userId: string, fields: TradeCallFields) {
  const { numbers } = await allowedNumbers(supabase, userId);
  let conversation: Database["public"]["Tables"]["conversations"]["Row"] | null = null;
  if (fields.conversationId) {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", fields.conversationId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Conversation not found.");
    if (!numbers.includes(data.app_number)) throw new Error("You are not assigned to that number.");
    conversation = data;
  }
  let lead: Database["public"]["Tables"]["leads"]["Row"] | null = null;
  if (fields.leadId) {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("id", fields.leadId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Lead not found.");
    lead = data;
  }
  const phone = normalizePhone(
    fields.phone || conversation?.contact_number || lead?.phone_number || "",
  );
  const summary =
    fields.summary?.trim() || conversation?.last_message_preview || lead?.message || "";
  const name = splitPerson(
    fields.firstName,
    fields.lastName,
    conversation?.contact_name || lead?.name,
  );
  return { conversation, lead, phone, summary, name, numbers };
}

function splitPerson(first?: string | null, last?: string | null, full?: string | null) {
  if (first?.trim() || last?.trim())
    return { firstName: first?.trim() ?? "", lastName: last?.trim() ?? "" };
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

export async function syncJobber(supabase: SB, userId: string, fields: TradeCallFields) {
  const admin = await adminClient();
  const ctx = await tradeContext(supabase, userId, fields);
  if (!ctx.summary) throw new Error("Add a summary of the call before creating a Jobber request.");
  const input: JobberCallInput = {
    phone: ctx.phone,
    firstName: ctx.name.firstName,
    lastName: ctx.name.lastName,
    email: fields.email,
    address: fields.street
      ? {
          street: fields.street,
          city: fields.city,
          state: fields.state,
          postalCode: fields.postalCode,
        }
      : null,
    summary: ctx.summary,
  };
  const token = await jobberAccessToken(admin, userId);
  const result = await syncCallToJobber(createJobberGraphql(fetch, token), input);
  const workspaceId = await resolveWorkspaceId(userId);
  await db(admin)
    .from("trade_syncs")
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
      provider: "jobber",
      conversation_id: ctx.conversation?.id ?? null,
      lead_id: ctx.lead?.id ?? null,
      external_client_id: result.clientId,
      external_record_id: result.requestId,
      matched_existing: result.matchedExistingClient,
      summary: ctx.summary,
    });
  if (ctx.conversation) {
    const { resolveWorkspaceIdForNumber } = await import("../workspace.server");
    const noteWorkspaceId =
      workspaceId ??
      (await resolveWorkspaceIdForNumber(ctx.conversation.app_number)).workspaceId;
    if (noteWorkspaceId) {
      await admin.from("messages").insert({
        conversation_id: ctx.conversation.id,
        direction: "note",
        channel: ctx.conversation.channel,
        from_number: ctx.conversation.app_number,
        to_number: ctx.conversation.contact_number,
        body: result.matchedExistingClient
          ? `Jobber request created for an existing client.`
          : `Jobber client and request created.`,
        is_internal_note: true,
        sent_by: userId,
        workspace_id: noteWorkspaceId,
      });
    }
  }
  return result;
}

export async function saveHousecallKey(userId: string, apiKey: string) {
  const trimmed = apiKey.trim();
  if (trimmed.length < 8) throw new Error("Paste the Housecall Pro API key.");
  const admin = await adminClient();
  const connection = await upsertConnection(admin, userId, "housecall_pro", {
    status: "connected",
    account_label: "Housecall Pro",
    metadata: { key_hint: `••••${trimmed.slice(-4)}`, plan_note: "MAX plan required" },
  });
  await saveSecret(admin, connection["id"] as string, { apiKey: trimmed });
  return { ok: true as const, keyHint: `••••${trimmed.slice(-4)}` };
}

export async function disconnectHousecall(userId: string) {
  const admin = await adminClient();
  const connection = await connectionFor(admin, userId, "housecall_pro");
  if (connection) {
    await db(admin).from("integration_secrets").delete().eq("connection_id", connection["id"]);
    await db(admin)
      .from("integration_connections")
      .update({ status: "disconnected", metadata: {}, updated_at: new Date().toISOString() })
      .eq("id", connection["id"]);
  }
  return { ok: true as const };
}

async function housecallKey(admin: SB, userId: string): Promise<string> {
  const connection = await connectionFor(admin, userId, "housecall_pro");
  if (!connection || connection["status"] !== "connected") {
    throw new Error("Connect a Housecall Pro API key first.");
  }
  const secret = await readSecret(admin, connection["id"] as string);
  const key = decryptField(secret, "api_key_ciphertext");
  if (!key) throw new Error("Housecall Pro API key is missing. Connect it again.");
  return key;
}

async function housecallRequest(apiKey: string, path: string, body: Record<string, unknown>) {
  const response = await fetch(`${HOUSECALL_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const json = text ? (JSON.parse(text) as Row) : {};
  if (response.status === 401 || response.status === 403) {
    throw new Error(`${HOUSECALL_MAX_PLAN_COPY} Housecall Pro returned ${response.status}.`);
  }
  if (!response.ok)
    throw new Error(
      (json["message"] as string | undefined) || `Housecall Pro returned ${response.status}.`,
    );
  return json;
}

export async function syncHousecall(supabase: SB, userId: string, fields: TradeCallFields) {
  const admin = await adminClient();
  const ctx = await tradeContext(supabase, userId, fields);
  if (!ctx.summary) throw new Error("Add a summary before creating a Housecall Pro lead.");
  const input: HousecallCallInput = {
    firstName: ctx.name.firstName,
    lastName: ctx.name.lastName,
    phone: ctx.phone,
    email: fields.email,
    street: fields.street,
    city: fields.city,
    state: fields.state,
    zip: fields.postalCode,
    summary: ctx.summary,
  };
  const key = await housecallKey(admin, userId);
  const customer = await housecallRequest(key, "/customers", buildHousecallCustomer(input));
  const customerId = String(customer["id"] ?? "");
  if (!customerId) throw new Error("Housecall Pro did not return a customer id.");
  const lead = await housecallRequest(key, "/leads", buildHousecallLead(input, customerId));
  const workspaceId = await resolveWorkspaceId(userId);
  await db(admin)
    .from("trade_syncs")
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
      provider: "housecall_pro",
      conversation_id: ctx.conversation?.id ?? null,
      lead_id: ctx.lead?.id ?? null,
      external_client_id: customerId,
      external_record_id: String(lead["id"] ?? ""),
      matched_existing: false,
      summary: ctx.summary,
    });
  return { customerId, leadId: String(lead["id"] ?? "") };
}

export async function saveReviewSettings(
  userId: string,
  input: {
    reviewUrl: string;
    businessName: string;
    enabled: boolean;
    cooldownDays: number;
    quietStart: string;
    quietEnd: string;
    timezone: string;
  },
) {
  const url = input.reviewUrl.trim();
  if (url) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error("Enter a full Google review link, starting with https://.");
    }
    if (parsed.protocol !== "https:") throw new Error("The review link must start with https://.");
  }
  const cooldown = Math.min(365, Math.max(1, Math.round(input.cooldownDays || 90)));
  const admin = await adminClient();
  const workspaceId = await resolveWorkspaceId(userId);
  const { error } = await db(admin)
    .from("review_settings")
    .upsert(
      {
        user_id: userId,
        workspace_id: workspaceId,
        google_review_url: url || null,
        business_name: input.businessName.trim() || null,
        enabled: input.enabled,
        cooldown_days: cooldown,
        quiet_start: input.quietStart || "21:00",
        quiet_end: input.quietEnd || "08:00",
        timezone: input.timezone || "America/Chicago",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

async function logConsent(
  admin: SB,
  input: {
    userId: string;
    workspaceId: string | null;
    contactNumber: string;
    purpose: string;
    action: string;
    source: string;
    detail: Row;
  },
) {
  await db(admin).from("consent_log").insert({
    user_id: input.userId,
    workspace_id: input.workspaceId,
    contact_number: input.contactNumber,
    purpose: input.purpose,
    action: input.action,
    source: input.source,
    detail: input.detail,
  });
}

export async function markJobDone(
  supabase: SB,
  userId: string,
  input: { conversationId?: string; leadId?: string },
) {
  const admin = await adminClient();
  const ctx = await tradeContext(supabase, userId, input);
  const target = ctx.conversation;
  const phone = ctx.phone;
  if (!phone || phone === "+") throw new Error("This contact has no phone number.");
  const workspaceId = await resolveWorkspaceId(userId);
  const doneAt = new Date().toISOString();
  if (target) {
    await admin
      .from("conversations")
      .update({ job_status: "done", job_done_at: doneAt, workspace_id: target.workspace_id })
      .eq("id", target.id);
  }
  if (ctx.lead) {
    await admin
      .from("leads")
      .update({
        job_status: "done",
        job_done_at: doneAt,
        phone_number: phone,
        conversation_id: target?.id ?? ctx.lead.conversation_id,
      })
      .eq("id", ctx.lead.id);
  }
  if (!target) {
    return { sent: false as const, reason: "no_conversation" as const };
  }

  const { data: settings } = await db(admin)
    .from("review_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!settings?.["enabled"]) {
    return { sent: false as const, reason: "reviews_disabled" as const, jobDone: true as const };
  }

  const [{ data: priorJob }, { data: priorContact }] = await Promise.all([
    db(admin)
      .from("review_requests")
      .select("id")
      .eq("conversation_id", target.id)
      .eq("status", "sent")
      .maybeSingle(),
    db(admin)
      .from("review_requests")
      .select("sent_at")
      .eq("user_id", userId)
      .eq("contact_number", phone)
      .eq("status", "sent")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const messaging = await messagingStateFor(admin, target.app_number);
  const compliance = await loadAutomatedTextDeps(admin, phone, target.app_number, "review");
  const decision = decideReviewRequest({
    optedOut: target.opted_out || compliance.optedOut,
    messagingServiceSid: messaging.messagingServiceSid ?? compliance.messagingServiceSid,
    textingReady: messaging.ready && compliance.campaignReady,
    hasConsent: compliance.hasConsent,
    complianceQuietHours: compliance.quietHours,
    now: new Date(),
    timezone: (settings["timezone"] as string | null) ?? "America/Chicago",
    quietStart: (settings["quiet_start"] as string | null) ?? "21:00",
    quietEnd: (settings["quiet_end"] as string | null) ?? "08:00",
    lastSentAt: priorContact?.["sent_at"] ? new Date(priorContact["sent_at"] as string) : null,
    cooldownDays: Number(settings["cooldown_days"] ?? 90),
    alreadySent: Boolean(priorJob),
    reviewUrl: (settings["google_review_url"] as string | null) ?? "",
    businessName: (settings["business_name"] as string | null) ?? "",
  });

  await logConsent(admin, {
    userId,
    workspaceId,
    contactNumber: phone,
    purpose: "review_request",
    action: consentActionFor(decision),
    source: "job_done",
    detail: { reason: decision.send ? "sent" : decision.reason, conversationId: target.id },
  });

  if (!decision.send) {
    await db(admin)
      .from("review_requests")
      .insert({
        user_id: userId,
        workspace_id: workspaceId,
        conversation_id: target.id,
        lead_id: ctx.lead?.id ?? null,
        contact_number: phone,
        status: "skipped",
        reason: decision.reason,
      });
    return { sent: false as const, reason: decision.reason, jobDone: true as const };
  }

  const delivered = await sendAutomatedText(admin, {
    userId,
    workspaceId,
    conversationId: target.id,
    appNumber: target.app_number,
    to: phone,
    body: decision.body,
    kind: "review",
    optedOut: target.opted_out || compliance.optedOut,
    messagingServiceSid: messaging.messagingServiceSid ?? compliance.messagingServiceSid,
    textingReady: messaging.ready && compliance.campaignReady,
    hasConsent: compliance.hasConsent,
    complianceQuietHours: compliance.quietHours,
    now: new Date(),
    enforceQuietHours: true,
    timezone: (settings["timezone"] as string | null) ?? "America/Chicago",
    quietStart: settings["quiet_start"] as string,
    quietEnd: settings["quiet_end"] as string,
    lastSentAt: priorContact?.["sent_at"] ? new Date(priorContact["sent_at"] as string) : null,
    cooldownDays: Number(settings["cooldown_days"] ?? 90),
    alreadySent: Boolean(priorJob),
  });
  if (!delivered.sent) {
    return { sent: false as const, reason: delivered.reason, jobDone: true as const };
  }
  await db(admin)
    .from("review_requests")
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
      conversation_id: target.id,
      lead_id: ctx.lead?.id ?? null,
      contact_number: phone,
      status: "sent",
      message_sid: delivered.sid,
      sent_at: new Date().toISOString(),
    });
  return { sent: true as const, sid: delivered.sid, jobDone: true as const };
}

function connectClient(): Stripe {
  const key = assertConnectTestKey(process.env["STRIPE_CONNECT_SECRET_KEY"]);
  return new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
}

async function rememberConnectAccount(
  admin: SB,
  userId: string,
  account: {
    id: string;
    livemode: boolean;
    display_name?: string | null;
    configuration?: {
      merchant?: {
        capabilities?: { card_payments?: { status?: string | null } | null } | null;
      } | null;
    } | null;
  },
) {
  if (account.livemode) throw new Error("Refusing a live-mode Stripe account.");
  const status = cardPaymentsStatus(account);
  const connection = await upsertConnection(admin, userId, "stripe_connect", {
    status: cardPaymentsActive(account) ? "connected" : "onboarding",
    external_account_id: account.id,
    account_label: account.display_name ?? "Stripe",
    metadata: { card_payments: status, livemode: false },
  });
  return { connection, status };
}

export async function startConnectOnboarding(
  supabase: SB,
  userId: string,
  urls: { returnUrl: string; refreshUrl: string },
) {
  const admin = await adminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, display_name")
    .eq("id", userId)
    .maybeSingle();
  const email = profile?.email;
  if (!email) throw new Error("Your profile needs an email before Stripe onboarding.");
  const stripe = connectClient();
  const existing = await connectionFor(admin, userId, "stripe_connect");
  let accountId = (existing?.["external_account_id"] as string | null) ?? null;
  if (!accountId) {
    const workspaceId = await resolveWorkspaceId(userId);
    const created = await stripe.v2.core.accounts.create(
      merchantAccountParams({
        email,
        displayName: profile?.display_name || email,
        userId,
        workspaceId,
      }),
    );
    const saved = await rememberConnectAccount(admin, userId, created);
    accountId = saved.connection["external_account_id"] as string;
  } else {
    const current = await stripe.v2.core.accounts.retrieve(accountId, {
      include: ["configuration.merchant"],
    });
    await rememberConnectAccount(admin, userId, current);
  }
  const link = await stripe.v2.core.accountLinks.create(
    accountOnboardingLinkParams({
      accountId,
      returnUrl: urls.returnUrl,
      refreshUrl: urls.refreshUrl,
    }),
  );
  if (link.livemode) throw new Error("Refusing a live-mode Stripe onboarding link.");
  return { url: link.url };
}

export async function refreshConnectStatus(userId: string) {
  const admin = await adminClient();
  const existing = await connectionFor(admin, userId, "stripe_connect");
  const accountId = existing?.["external_account_id"] as string | undefined;
  if (!accountId) return { chargesActive: false, cardPayments: "unknown" };
  const stripe = connectClient();
  const account = await stripe.v2.core.accounts.retrieve(accountId, {
    include: ["configuration.merchant"],
  });
  const saved = await rememberConnectAccount(admin, userId, account);
  return { chargesActive: saved.status === "active", cardPayments: saved.status };
}

export async function createPaymentLink(
  supabase: SB,
  userId: string,
  input: { conversationId: string; amount: string; description: string },
) {
  const admin = await adminClient();
  const ctx = await tradeContext(supabase, userId, { conversationId: input.conversationId });
  const conversation = ctx.conversation;
  if (!conversation) throw new Error("Conversation not found.");
  if (conversation.channel === "whatsapp") {
    throw new Error("Payment links are sent by SMS from a registered texting line.");
  }
  const amountCents = parseAmountToCents(input.amount);
  const description = input.description.trim();
  const connect = await connectionFor(admin, userId, "stripe_connect");
  const accountId = (connect?.["external_account_id"] as string | null) ?? "";
  const messaging = await messagingStateFor(admin, conversation.app_number);
  const compliance = await loadAutomatedTextDeps(
    admin,
    conversation.contact_number,
    conversation.app_number,
    "automated",
  );
  const gate = canSendAutomatedText({
    to: conversation.contact_number,
    from: conversation.app_number,
    optedOut: conversation.opted_out || compliance.optedOut,
    messagingServiceSid: messaging.messagingServiceSid ?? compliance.messagingServiceSid,
    textingReady: messaging.ready && compliance.campaignReady,
    complianceQuietHours: compliance.quietHours,
    now: new Date(),
    enforceQuietHours: false,
    alreadySent: false,
    cooldownDays: 0,
  });
  if (!gate.allow) {
    return { sent: false as const, reason: gate.reason };
  }
  const stripe = connectClient();
  const account = await stripe.v2.core.accounts.retrieve(accountId, {
    include: ["configuration.merchant"],
  });
  if (!cardPaymentsActive(account)) {
    throw new Error(
      "Finish Stripe test onboarding before sending a payment link. Card payments are not active.",
    );
  }
  const workspaceId = await resolveWorkspaceId(userId);
  const { data: created, error } = await db(admin)
    .from("payment_links")
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
      conversation_id: conversation.id,
      connected_account_id: accountId,
      amount_cents: amountCents,
      description,
      status: "created",
      livemode: false,
    })
    .select("*")
    .single();
  if (error || !created) throw new Error(error?.message ?? "Could not save the payment link.");
  const checkout = directChargeCheckoutParams({
    amountCents,
    description,
    connectedAccountId: accountId,
    paymentId: created["id"] as string,
    conversationId: conversation.id,
    successUrl: `${PUBLIC_BASE_URL}/pay/return`,
    cancelUrl: `${PUBLIC_BASE_URL}/pay/return?canceled=1`,
  });
  const session = await stripe.checkout.sessions.create(checkout.params, checkout.requestOptions);
  if (session.livemode) throw new Error("Refusing a live-mode Checkout Session.");
  const url = session.url;
  if (!url) throw new Error("Stripe did not return a payment link.");
  await db(admin)
    .from("payment_links")
    .update({ checkout_session_id: session.id, url, updated_at: new Date().toISOString() })
    .eq("id", created["id"]);
  const body = paymentLinkBody({ description, url, amountLabel: formatUsd(amountCents) });
  const delivered = await sendAutomatedText(admin, {
    userId,
    workspaceId,
    conversationId: conversation.id,
    appNumber: conversation.app_number,
    to: conversation.contact_number,
    body,
    kind: "automated",
    optedOut: conversation.opted_out || compliance.optedOut,
    messagingServiceSid: messaging.messagingServiceSid ?? compliance.messagingServiceSid,
    textingReady: messaging.ready && compliance.campaignReady,
    complianceQuietHours: compliance.quietHours,
    now: new Date(),
    enforceQuietHours: false,
  });
  await logConsent(admin, {
    userId,
    workspaceId,
    contactNumber: conversation.contact_number,
    purpose: "payment_link",
    action: delivered.sent ? "sent" : "skipped",
    source: "payment_link",
    detail: { reason: delivered.sent ? "sent" : delivered.reason, paymentId: created["id"] },
  });
  if (!delivered.sent) {
    return { sent: false as const, reason: delivered.reason, url };
  }
  await db(admin)
    .from("payment_links")
    .update({ status: "sent", message_sid: delivered.sid, updated_at: new Date().toISOString() })
    .eq("id", created["id"]);
  return { sent: true as const, url, sid: delivered.sid, amountLabel: formatUsd(amountCents) };
}

export async function applyConnectWebhook(event: {
  id?: string;
  type?: string;
  livemode?: boolean;
  data?: { object?: Record<string, unknown> };
}) {
  const interpreted = interpretConnectEvent(event);
  if (interpreted.ignore) return interpreted;
  if (!event.id) return { ignore: true as const, reason: "missing_event_id" };
  const admin = await adminClient();
  const { error: inserted } = await db(admin).from("stripe_connect_events").insert({
    event_id: event.id,
    payment_link_id: interpreted.paymentId,
  });
  if (inserted && /duplicate|unique/i.test(inserted.message)) {
    return { ignore: true as const, reason: "duplicate_event" };
  }
  let payment: Row | null = null;
  if (interpreted.paymentId) {
    const found = await db(admin)
      .from("payment_links")
      .select("*")
      .eq("id", interpreted.paymentId)
      .maybeSingle();
    payment = found.data;
  } else if (interpreted.checkoutSessionId) {
    const found = await db(admin)
      .from("payment_links")
      .select("*")
      .eq("checkout_session_id", interpreted.checkoutSessionId)
      .maybeSingle();
    payment = found.data;
  }
  if (!payment) return { ignore: true as const, reason: "unknown_payment" };
  await db(admin)
    .from("payment_links")
    .update({ status: interpreted.status, updated_at: new Date().toISOString() })
    .eq("id", payment["id"]);
  if (interpreted.paymentId || payment["id"]) {
    await db(admin)
      .from("stripe_connect_events")
      .update({ payment_link_id: payment["id"] })
      .eq("event_id", event.id);
  }
  const conversationId = payment["conversation_id"] as string | null;
  if (conversationId) {
    const { data: conversation } = await admin
      .from("conversations")
      .select("id, channel, app_number, contact_number")
      .eq("id", conversationId)
      .maybeSingle();
    if (conversation) {
      const { resolveWorkspaceIdForNumber } = await import("../workspace.server");
      const noteWorkspaceId =
        ((payment["workspace_id"] as string | null) ?? null) ??
        (await resolveWorkspaceIdForNumber(conversation.app_number)).workspaceId;
      if (noteWorkspaceId) {
        await admin.from("messages").insert({
          conversation_id: conversation.id,
          direction: "note",
          channel: conversation.channel,
          from_number: conversation.app_number,
          to_number: conversation.contact_number,
          body: interpreted.note,
          is_internal_note: true,
          workspace_id: noteWorkspaceId,
        });
      }
    }
  }
  return { ignore: false as const, status: interpreted.status };
}

export async function savePortDraft(
  userId: string,
  draft: PortDraft,
  bill: { filename: string; mime: string; base64: string },
) {
  const prepared = preparePortDraft({ ...draft, hasUtilityBill: Boolean(bill.base64) });
  if (!prepared.ok) throw new Error(prepared.reason);
  if (bill.base64.length > 8_000_000) throw new Error("Utility bill must be under 8 MB.");
  const admin = await adminClient();
  const workspaceId = await resolveWorkspaceId(userId);
  const { data, error } = await db(admin)
    .from("port_in_requests")
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
      phone_number: prepared.phoneNumber,
      status: "ready",
      account_last4: prepared.accountLast4,
      customer_name: draft.loa.customerName.trim(),
      notification_email: draft.notificationEmail ?? draft.loa.authorizedRepresentativeEmail,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not save the port request.");
  const { error: privateError } = await db(admin)
    .from("port_in_private")
    .insert({
      port_in_request_id: data["id"],
      loa_ciphertext: encryptConnectionKey(JSON.stringify(draft.loa)),
      bill_ciphertext: encryptConnectionKey(bill.base64),
      bill_filename: bill.filename || "utility-bill",
      bill_mime: bill.mime || "application/pdf",
    });
  if (privateError) throw new Error(privateError.message);
  return {
    id: data["id"] as string,
    status: "ready" as const,
    forwardingDefault: true,
    submitted: false as const,
  };
}

export async function confirmPortIn(userId: string, portId: string, confirmed: boolean) {
  const admin = await adminClient();
  const { data: row, error } = await db(admin)
    .from("port_in_requests")
    .select("*")
    .eq("id", portId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Port request not found.");
  const { data: secret, error: secretError } = await db(admin)
    .from("port_in_private")
    .select("*")
    .eq("port_in_request_id", portId)
    .maybeSingle();
  if (secretError) throw new Error(secretError.message);
  if (!secret) throw new Error("The letter of authorization is missing. Start the port again.");
  const loa = JSON.parse(
    decryptConnectionKey(secret["loa_ciphertext"] as string),
  ) as PortDraft["loa"];
  const billBase64 = decryptConnectionKey(secret["bill_ciphertext"] as string);
  const draft: PortDraft = {
    phoneNumber: row["phone_number"] as string,
    loa,
    hasUtilityBill: Boolean(billBase64),
    notificationEmail:
      (row["notification_email"] as string | null) ?? loa.authorizedRepresentativeEmail,
  };
  const result = await runPortSubmission(
    { ...draft, confirmed, accountSid: process.env["TWILIO_ACCOUNT_SID"] ?? null },
    {
      live: process.env["PORT_IN_LIVE"] === "true",
      uploadDocument: async () => {
        const sid = process.env["TWILIO_ACCOUNT_SID"];
        const token = process.env["TWILIO_AUTH_TOKEN"];
        if (!sid || !token)
          throw new Error("Twilio credentials are required to upload the utility bill.");
        const bytes = Buffer.from(billBase64, "base64");
        const form = new FormData();
        form.set("document_type", "utility_bill");
        form.set("friendly_name", secret["bill_filename"] as string);
        form.set(
          "File",
          new Blob([bytes], { type: secret["bill_mime"] as string }),
          secret["bill_filename"] as string,
        );
        const response = await fetch("https://numbers-upload.twilio.com/v1/Documents", {
          method: "POST",
          headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}` },
          body: form,
        });
        const json = (await response.json()) as { sid?: string; message?: string };
        if (!response.ok || !json.sid)
          throw new Error(json.message || "Utility bill upload failed.");
        return { sid: json.sid };
      },
      createPortIn: async (body) => {
        const sid = process.env["TWILIO_ACCOUNT_SID"];
        const token = process.env["TWILIO_AUTH_TOKEN"];
        if (!sid || !token) throw new Error("Twilio credentials are required to submit a port.");
        const response = await fetch("https://numbers.twilio.com/v1/Porting/PortIn", {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        const json = (await response.json()) as { port_in_request_sid?: string; message?: string };
        if (!response.ok || !json.port_in_request_sid) {
          throw new Error(json.message || "Twilio did not accept the port-in request.");
        }
        return { port_in_request_sid: json.port_in_request_sid };
      },
    },
  );
  if (result.submitted) {
    await db(admin)
      .from("port_in_requests")
      .update({
        status: "submitted",
        twilio_port_sid: result.sid,
        updated_at: new Date().toISOString(),
      })
      .eq("id", portId);
    await db(admin).from("port_in_events").insert({
      port_in_request_id: portId,
      user_id: userId,
      workspace_id: row["workspace_id"],
      status: "submitted",
      twilio_status: "pending",
      detail: {},
    });
  }
  return {
    submitted: result.submitted,
    status: result.submitted ? ("submitted" as const) : ("ready" as const),
    reason: result.submitted ? null : result.reason,
    forwardingDefault: true,
  };
}

export async function applyPortWebhook(params: Record<string, string>) {
  const admin = await adminClient();
  const sid = params["port_in_request_sid"] ?? "";
  const phone = params["phone_number"] ?? "";
  let row: Row | null = null;
  if (sid) {
    const found = await db(admin)
      .from("port_in_requests")
      .select("*")
      .eq("twilio_port_sid", sid)
      .maybeSingle();
    row = found.data;
  }
  if (!row && phone) {
    const found = await db(admin)
      .from("port_in_requests")
      .select("*")
      .eq("phone_number", phone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    row = found.data;
  }
  if (!row) return { ok: false as const, reason: "unknown_port" };
  const incoming = parsePortWebhookStatus(params["status"] ?? "");
  const current = (row["status"] as PortStatus) ?? "submitted";
  const next = nextPortStatus(current, incoming);
  const rejection = params["rejection_reason"] || params["not_portable_reason"] || null;
  await db(admin)
    .from("port_in_requests")
    .update({
      status: next,
      rejection_reason: rejection,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row["id"]);
  await db(admin)
    .from("port_in_events")
    .insert({
      port_in_request_id: row["id"],
      user_id: row["user_id"],
      workspace_id: row["workspace_id"],
      status: next,
      twilio_status: params["status"] ?? null,
      detail: {
        portable: params["portable"] ?? null,
        rejection_reason: rejection,
      },
    });
  return { ok: true as const, status: next };
}
