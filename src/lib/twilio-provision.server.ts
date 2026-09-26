import type { SupabaseClient } from "@supabase/supabase-js";

import { decryptConnectionKey, encryptConnectionKey } from "./connection-key-crypto.server";
import { selectTwilioAccount, type TwilioAccountCredentials } from "./twilio-account";
import { twilioRequest, type TwilioAccountAuth } from "./twilio.server";
import { webhookUrl } from "./app.server";

type Row = {
  workspace_id: string;
  subaccount_sid: string | null;
  subaccount_auth_token_encrypted: string | null;
  api_key_sid: string | null;
  api_key_secret_encrypted: string | null;
  twiml_app_sid: string | null;
  messaging_service_sid: string | null;
  uses_parent_account: boolean;
};

async function adminClient(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

function parentAuth(): TwilioAccountAuth {
  const accountSid = process.env["TWILIO_ACCOUNT_SID"];
  const authToken = process.env["TWILIO_AUTH_TOKEN"];
  if (!accountSid || !authToken) {
    throw new Error(
      "The parent Twilio account is not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN).",
    );
  }
  return { accountSid, authToken };
}

function decryptOrNull(stored: string | null): string | null {
  if (!stored) return null;
  return decryptConnectionKey(stored);
}

async function loadRow(workspaceId: string): Promise<Row | null> {
  const admin = await adminClient();
  const { data } = await admin
    .from("workspace_twilio")
    .select(
      "workspace_id, subaccount_sid, subaccount_auth_token_encrypted, api_key_sid, api_key_secret_encrypted, twiml_app_sid, messaging_service_sid, uses_parent_account",
    )
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return (data as Row | null) ?? null;
}

function toCredentials(row: Row | null): TwilioAccountCredentials {
  const parent = parentAuth();
  return selectTwilioAccount({
    usesParentAccount: row?.uses_parent_account ?? true,
    subaccountSid: row?.subaccount_sid ?? null,
    subaccountAuthToken: decryptOrNull(row?.subaccount_auth_token_encrypted ?? null),
    apiKeySid: row?.api_key_sid ?? null,
    apiKeySecret: decryptOrNull(row?.api_key_secret_encrypted ?? null),
    twimlAppSid: row?.twiml_app_sid ?? null,
    messagingServiceSid: row?.messaging_service_sid ?? null,
    parent: {
      accountSid: parent.accountSid,
      authToken: parent.authToken,
      apiKeySid: process.env["TWILIO_API_KEY_SID"] ?? null,
      apiKeySecret: process.env["TWILIO_API_KEY_SECRET"] ?? null,
    },
  });
}

/** Credentials for a workspace. Does not create anything. */
export async function twilioAccountForWorkspace(
  workspaceId: string,
): Promise<TwilioAccountCredentials> {
  return toCredentials(await loadRow(workspaceId));
}

async function saveRow(workspaceId: string, patch: Record<string, unknown>): Promise<void> {
  const admin = await adminClient();
  const { error } = await admin.from("workspace_twilio").upsert(
    { workspace_id: workspaceId, ...patch, updated_at: new Date().toISOString() },
    {
      onConflict: "workspace_id",
    },
  );
  if (error) throw new Error(error.message);
}

/**
 * Create the workspace subaccount, Voice SDK API key, TwiML App, and Messaging
 * Service. Safe to call again: existing SIDs are left in place.
 * The founding workspace stays on the parent account unless `forceSubaccount`.
 */
export async function provisionWorkspaceTelephony(
  workspaceId: string,
  options: { forceSubaccount?: boolean; friendlyName?: string } = {},
): Promise<TwilioAccountCredentials> {
  const existing = await loadRow(workspaceId);
  if (existing?.uses_parent_account && !options.forceSubaccount) {
    return toCredentials(existing);
  }

  const parent = parentAuth();
  let subaccountSid = existing?.subaccount_sid ?? null;
  let authToken = decryptOrNull(existing?.subaccount_auth_token_encrypted ?? null);

  if (!subaccountSid || !authToken) {
    const created = await twilioRequest<{ sid: string; auth_token: string }>({
      method: "POST",
      host: "api-direct",
      path: "/2010-04-01/Accounts.json",
      account: parent,
      params: { FriendlyName: options.friendlyName ?? `SixVox ${workspaceId.slice(0, 8)}` },
    });
    subaccountSid = created.sid;
    authToken = created.auth_token;
    await saveRow(workspaceId, {
      subaccount_sid: subaccountSid,
      subaccount_auth_token_encrypted: encryptConnectionKey(authToken),
      uses_parent_account: false,
    });
  }

  const sub: TwilioAccountAuth = { accountSid: subaccountSid, authToken };
  let apiKeySid = existing?.api_key_sid ?? null;
  let apiKeySecret = decryptOrNull(existing?.api_key_secret_encrypted ?? null);
  if (!apiKeySid || !apiKeySecret) {
    const key = await twilioRequest<{ sid: string; secret: string }>({
      method: "POST",
      path: "/Keys.json",
      account: sub,
      params: { FriendlyName: "SixVox Voice" },
    });
    apiKeySid = key.sid;
    apiKeySecret = key.secret;
    await saveRow(workspaceId, {
      api_key_sid: apiKeySid,
      api_key_secret_encrypted: encryptConnectionKey(apiKeySecret),
    });
  }

  let twimlAppSid = existing?.twiml_app_sid ?? null;
  if (!twimlAppSid) {
    const app = await twilioRequest<{ sid: string }>({
      method: "POST",
      path: "/Applications.json",
      account: sub,
      params: {
        FriendlyName: "SixVox Voice",
        VoiceUrl: webhookUrl("app-voice"),
        VoiceMethod: "POST",
        VoiceFallbackUrl: webhookUrl("voice-fallback"),
        VoiceFallbackMethod: "POST",
        StatusCallback: webhookUrl("status"),
        StatusCallbackMethod: "POST",
      },
    });
    twimlAppSid = app.sid;
    await saveRow(workspaceId, { twiml_app_sid: twimlAppSid });
  }

  let messagingServiceSid = existing?.messaging_service_sid ?? null;
  if (!messagingServiceSid) {
    const service = await twilioRequest<{ sid: string }>({
      method: "POST",
      host: "messaging",
      path: "/v1/Services",
      account: sub,
      params: {
        FriendlyName: "SixVox messaging",
        InboundRequestUrl: webhookUrl("sms"),
        InboundMethod: "POST",
        FallbackUrl: webhookUrl("sms"),
        FallbackMethod: "POST",
        StatusCallback: webhookUrl("status"),
        UseInboundWebhookOnNumber: false,
      },
    });
    messagingServiceSid = service.sid;
    await saveRow(workspaceId, { messaging_service_sid: messagingServiceSid });
  }

  await saveRow(workspaceId, { uses_parent_account: false });
  const fresh = await loadRow(workspaceId);
  return toCredentials(fresh);
}

/**
 * Owner-triggered, idempotent move of this workspace's numbers onto its
 * subaccount. Not run automatically. Uses the parent account to change
 * IncomingPhoneNumber.AccountSid, which Twilio allows inside the same parent.
 */
export async function migrateNumbersOntoSubaccount(workspaceId: string): Promise<{
  moved: string[];
  skipped: string[];
  subaccountSid: string;
}> {
  const account = await provisionWorkspaceTelephony(workspaceId, { forceSubaccount: true });
  if (account.source !== "subaccount") {
    throw new Error("Subaccount provisioning did not finish, so numbers were not moved.");
  }
  const admin = await adminClient();
  const { data: numbers } = await admin
    .from("phone_numbers")
    .select("sid, phone_number, twilio_account_sid")
    .eq("workspace_id", workspaceId);
  const parent = parentAuth();
  const moved: string[] = [];
  const skipped: string[] = [];
  for (const row of numbers ?? []) {
    const sid = row["sid"] as string;
    const phone = row["phone_number"] as string;
    const current = (row["twilio_account_sid"] as string | null) ?? null;
    if (current === account.accountSid) {
      skipped.push(phone);
      continue;
    }
    await twilioRequest({
      method: "POST",
      path: `/IncomingPhoneNumbers/${sid}.json`,
      account: parent,
      params: { AccountSid: account.accountSid },
    });
    await admin
      .from("phone_numbers")
      .update({ twilio_account_sid: account.accountSid })
      .eq("sid", sid);
    moved.push(phone);
  }
  await saveRow(workspaceId, {
    uses_parent_account: false,
    migrated_at: new Date().toISOString(),
  });
  return { moved, skipped, subaccountSid: account.accountSid };
}
