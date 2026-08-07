import { buildPushPayload, type PushSubscription } from "@block65/webcrypto-web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

type NotifyPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  /** "call" renders a ringing, sticky notification with an Answer action. */
  type?: "message" | "call" | "call-ended";
  requireInteraction?: boolean;
};

function vapid() {
  return {
    subject: process.env["VAPID_SUBJECT"] ?? "mailto:push@signalbox.app",
    publicKey: process.env["VAPID_PUBLIC_KEY"],
    privateKey: process.env["VAPID_PRIVATE_KEY"],
  };
}

/** Everyone who should be alerted about activity on an app number: admins + the assignee. */
export async function recipientsForNumber(
  admin: SupabaseClient,
  appNumber: string,
): Promise<string[]> {
  const ids = new Set<string>();

  const { data: admins } = await admin
    .from("user_roles")
    .select("user_id, role")
    .in("role", ["owner", "admin"]);
  for (const row of admins ?? []) ids.add(row.user_id as string);

  const { data: number } = await admin
    .from("phone_numbers")
    .select("assigned_to")
    .eq("phone_number", appNumber)
    .maybeSingle();
  if (number?.assigned_to) ids.add(number.assigned_to as string);

  return [...ids];
}

/** Send a web push to every device registered by the given users. */
export async function sendPushToUsers(
  admin: SupabaseClient,
  userIds: string[],
  payload: NotifyPayload,
): Promise<number> {
  const keys = vapid();
  if (!keys.privateKey || !keys.publicKey || userIds.length === 0) return 0;

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);
  if (!subs?.length) return 0;

  const stale: string[] = [];
  let sent = 0;

  await Promise.all(
    subs.map(async (row) => {
      const subscription: PushSubscription = {
        endpoint: row.endpoint as string,
        expirationTime: null,
        keys: { p256dh: row.p256dh as string, auth: row.auth as string },
      };
      try {
        const request = await buildPushPayload(
          {
            data: payload,
            options: { ttl: payload.type === "call" ? 45 : 3600, urgency: "high" },
          },
          subscription,
          keys,
        );
        const headers = Object.fromEntries(
          Object.entries(request.headers).filter(([, v]) => typeof v === "string"),
        ) as Record<string, string>;
        const res = await fetch(subscription.endpoint, {
          method: request.method,
          headers,
          body: request.body as BodyInit,
        });
        if (res.status === 404 || res.status === 410) stale.push(row.id as string);
        else if (res.ok) sent += 1;
        else console.error(`Push failed [${res.status}]: ${await res.text()}`);
      } catch (error) {
        console.error("Push send error", error);
      }
    }),
  );

  if (stale.length) await admin.from("push_subscriptions").delete().in("id", stale);
  return sent;
}

export async function notifyNumberWatchers(
  admin: SupabaseClient,
  appNumber: string,
  payload: NotifyPayload,
): Promise<number> {
  const users = await recipientsForNumber(admin, appNumber);
  return sendPushToUsers(admin, users, payload);
}