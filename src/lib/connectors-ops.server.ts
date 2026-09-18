import type { SupabaseClient } from "@supabase/supabase-js";

import { getRole, isAdminRole } from "./app.server";
import { emailStatus } from "./email.server";
import { accountStatus as elevenStatus, hasElevenLabs } from "./elevenlabs.server";
import * as gcal from "./gcal.server";
import { mapsConfigured } from "./maps.server";
import { credentialHealth, hasDirectCredentials } from "./twilio.server";

export type ConnectorState = "connected" | "action" | "unavailable";

export type ConnectorCard = {
  id: string;
  name: string;
  category: "Phone" | "AI" | "Google" | "Email" | "Alerts";
  description: string;
  state: ConnectorState;
  detail: string;
  href: string | null;
  adminOnly: boolean;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

async function safe<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch {
    return fallback;
  }
}

type NumberRow = {
  sid: string;
  phone_number: string;
  webhook_wired: boolean | null;
};

export async function connectorsOverview(supabase: SupabaseClient, userId: string) {
  const role = await getRole(supabase, userId);
  const isAdmin = isAdminRole(role);
  const db = await admin();

  const [numbers, twimlApps, email, gmailMeta, elevenlabs, pushDevices, carrier] =
    await Promise.all([
    safe(
      async () =>
        ((await supabase.from("phone_numbers").select("sid, phone_number, webhook_wired"))
          .data ?? []) as NumberRow[],
      [] as NumberRow[],
    ),
    safe(
      async () =>
        ((await db.from("twiml_apps").select("sid, is_default")).data ?? []) as Array<{
          sid: string;
        }>,
      [] as Array<{ sid: string }>,
    ),
    safe(() => emailStatus(db), {
      connected: false,
      domain: "",
      verified: false,
      domainStatus: "unavailable",
      recent: [],
    }),
    safe(async () => {
      const { getConnectionMeta } = await import("./app-user-connections.server");
      return (await getConnectionMeta(userId, "google_mail")) as {
        account_email?: string | null;
      } | null;
    }, null as { account_email?: string | null } | null),
    safe(
      async () => (hasElevenLabs() ? await elevenStatus() : null),
      null as Awaited<ReturnType<typeof elevenStatus>> | null,
    ),
    safe(
      async () =>
        ((await supabase.from("push_subscriptions").select("id").eq("user_id", userId)).data ??
          []) as Array<{ id: string }>,
      [] as Array<{ id: string }>,
    ),
      safe(() => credentialHealth(), {
        gateway: "error" as const,
        direct: "error" as const,
        healthy: false,
        message: "Could not reach the phone service just now.",
      }),
    ]);

  const wired = numbers.filter((n) => n.webhook_wired).length;
  const hasVoiceKeys = Boolean(
    process.env["TWILIO_API_KEY_SID"] && process.env["TWILIO_API_KEY_SECRET"],
  );
  const assistantHref = numbers[0] ? `/assistant/${numbers[0].sid}` : "/numbers";

  const cards: ConnectorCard[] = [
    {
      id: "line",
      name: "SixVox number",
      category: "Phone",
      description: "Your business line for calls and texts.",
      state: numbers.length ? "connected" : "action",
      detail: numbers.length
        ? `${numbers.length} number${numbers.length > 1 ? "s" : ""} · ${wired} fully wired${
            wired < numbers.length ? ` · ${numbers.length - wired} need${numbers.length - wired === 1 ? "s" : ""} attention` : ""
          }`
        : "No number yet — claim one to start.",

      href: "/numbers",
      adminOnly: false,
    },
    {
      id: "carrier",
      name: "Carrier network",
      category: "Phone",
      description: "Delivery for calls, SMS and MMS.",
      state: carrier.healthy ? "connected" : carrier.gateway === "rejected" ? "action" : "unavailable",
      detail: carrier.healthy
        ? hasDirectCredentials()
          ? "Live — messaging, voice and verification enabled"
          : "Live — messaging and voice enabled"
        : (carrier.message ?? "Not configured for this workspace"),
      href: isAdmin ? "/console" : null,
      adminOnly: true,
    },
    {
      id: "in-app-calling",
      name: "In-app calling",
      category: "Phone",
      description: "Place and take calls right inside SixVox.",
      state: twimlApps.length && hasVoiceKeys ? "connected" : "action",
      detail: !hasVoiceKeys
        ? "Calling keys missing — an admin can finish setup"
        : twimlApps.length
          ? "Calling profile active"
          : "Create the calling profile in Settings",
      href: "/settings",
      adminOnly: true,
    },
    {
      id: "ai-receptionist",
      name: "AI receptionist",
      category: "AI",
      description: "Answers, screens and takes messages when you can't.",
      state: elevenlabs?.connected ? "connected" : "action",
      detail: elevenlabs?.connected
        ? `Voice engine ready${elevenlabs.tier ? ` · ${elevenlabs.tier} plan` : ""}`
        : "Voice engine not connected yet",
      href: assistantHref,
      adminOnly: false,
    },
    {
      id: "gmail",
      name: "Gmail",
      category: "Google",
      description: "Read and reply to customer email from Tools.",
      state: gmailMeta ? "connected" : "action",
      detail: gmailMeta
        ? `Connected${gmailMeta.account_email ? ` · ${gmailMeta.account_email}` : ""}`
        : "Sign in with Google to link your mailbox",
      href: "/tools",
      adminOnly: false,
    },
    {
      id: "calendar",
      name: "Google Calendar",
      category: "Google",
      description: "Availability and booking from calls and texts.",
      state: gcal.calendarConfigured() ? "connected" : "action",
      detail: gcal.calendarConfigured() ? "Calendar sync available" : "Not connected yet",
      href: "/tools",
      adminOnly: false,
    },
    {
      id: "maps",
      name: "Places & maps",
      category: "Google",
      description: "Look up addresses and route to saved locations.",
      state: mapsConfigured() ? "connected" : "unavailable",
      detail: mapsConfigured() ? "Search and directions enabled" : "Not configured",
      href: "/tools",
      adminOnly: false,
    },
    {
      id: "email-delivery",
      name: "Email delivery",
      category: "Email",
      description: "Branded notification and alert emails.",
      state: email.connected ? (email.verified ? "connected" : "action") : "unavailable",
      detail: email.connected
        ? `${email.domain} · ${email.verified ? "verified" : email.domainStatus}`
        : "Sending not configured",
      href: "/tools",
      adminOnly: false,
    },
    {
      id: "push",
      name: "Push alerts",
      category: "Alerts",
      description: "Instant alerts for new messages and missed calls.",
      state: pushDevices.length ? "connected" : "action",
      detail: pushDevices.length
        ? `${pushDevices.length} device${pushDevices.length > 1 ? "s" : ""} registered`
        : "Turn on alerts for this device",
      href: "/settings",
      adminOnly: false,
    },
  ];

  const connectors = cards.filter((card) => !card.adminOnly || isAdmin);

  const steps = [
    {
      id: "line",
      title: "Claim your SixVox number",
      body: "Pick a local or toll-free line — this is the number customers call and text.",
      href: "/numbers",
      cta: "Open numbers",
      done: numbers.length > 0,
    },
    {
      id: "push",
      title: "Turn on instant alerts",
      body: "Get a push the moment a message lands or a call is missed.",
      href: "/settings",
      cta: "Enable alerts",
      done: pushDevices.length > 0,
    },
    {
      id: "ai-receptionist",
      title: "Set up your AI receptionist",
      body: "Choose a voice and greeting so every call gets answered.",
      href: assistantHref,
      cta: "Configure receptionist",
      done: Boolean(elevenlabs?.connected) && numbers.length > 0,
    },
    {
      id: "gmail",
      title: "Connect your Gmail",
      body: "Bring email conversations alongside calls and texts.",
      href: "/tools",
      cta: "Connect Google",
      done: Boolean(gmailMeta),
    },
    {
      id: "calendar",
      title: "Link your calendar",
      body: "Let callers book time that actually works for you.",
      href: "/tools",
      cta: "Open calendar sync",
      done: gcal.calendarConfigured(),
    },
  ];

  return {
    isAdmin,
    connectors,
    steps,
    summary: {
      connected: connectors.filter((c) => c.state === "connected").length,
      total: connectors.length,
      nextStep: steps.find((s) => !s.done)?.id ?? null,
    },
  };
}