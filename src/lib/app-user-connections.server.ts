import type { SupabaseClient } from "@supabase/supabase-js";

import { decryptConnectionKey, encryptConnectionKey } from "./connection-key-crypto.server";

async function admin(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

export async function saveConnectionKeyForUser(
  userId: string,
  connectorId: string,
  connectionAPIKey: string,
  meta?: { accountEmail?: string | null; scopes?: string[] },
) {
  const db = await admin();
  const { error } = await db.from("app_user_connections").upsert(
    {
      user_id: userId,
      connector_id: connectorId,
      connection_key_ciphertext: encryptConnectionKey(connectionAPIKey),
      account_email: meta?.accountEmail ?? null,
      scopes: meta?.scopes ?? [],
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,connector_id" },
  );
  if (error) throw error;
}

export async function getConnectionKeyForUser(
  userId: string,
  connectorId: string,
): Promise<string | null> {
  const db = await admin();
  const { data, error } = await db
    .from("app_user_connections")
    .select("connection_key_ciphertext")
    .eq("user_id", userId)
    .eq("connector_id", connectorId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  try {
    return decryptConnectionKey(data.connection_key_ciphertext as string);
  } catch (e) {
    console.error("connection key decrypt failed", e);
    return null;
  }
}

export async function getConnectionMeta(userId: string, connectorId: string) {
  const db = await admin();
  const { data } = await db
    .from("app_user_connections")
    .select("account_email, scopes, updated_at")
    .eq("user_id", userId)
    .eq("connector_id", connectorId)
    .maybeSingle();
  return data ?? null;
}

export async function setConnectionAccountEmail(
  userId: string,
  connectorId: string,
  accountEmail: string,
) {
  const db = await admin();
  await db
    .from("app_user_connections")
    .update({ account_email: accountEmail })
    .eq("user_id", userId)
    .eq("connector_id", connectorId);
}

export async function deleteConnectionForUser(userId: string, connectorId: string) {
  const db = await admin();
  await db
    .from("app_user_connections")
    .delete()
    .eq("user_id", userId)
    .eq("connector_id", connectorId);
}
