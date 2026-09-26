import type { SupabaseClient } from "@supabase/supabase-js";

import { prefillAiGreeting } from "./ai-greeting";
import { normalizePhone, twilioRequest } from "./twilio.server";

type SB = SupabaseClient;

async function adminClient(): Promise<SB> {
  // Loaded lazily so importing this module does not require Supabase env vars.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SB;
}

function verifyServiceSid(): string {
  const sid = process.env["TWILIO_VERIFY_SERVICE_SID"]?.trim();
  if (!sid) {
    throw new Error("Phone verification is not configured (TWILIO_VERIFY_SERVICE_SID).");
  }
  return sid;
}

export async function startPhoneVerification(userId: string, phone: string) {
  const to = normalizePhone(phone);
  if (to.replace(/\D/g, "").length < 10) {
    throw new Error("Enter a real mobile number.");
  }
  await twilioRequest({
    host: "verify",
    method: "POST",
    path: `/v2/Services/${verifyServiceSid()}/Verifications`,
    params: { To: to, Channel: "sms" },
  });
  const admin = await adminClient();
  const { error } = await admin.from("phone_verifications").upsert(
    {
      user_id: userId,
      phone_e164: to,
      status: "pending",
      verified_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
  return { phone: to, status: "pending" as const };
}

export async function checkPhoneVerification(userId: string, phone: string, code: string) {
  const to = normalizePhone(phone);
  const result = await twilioRequest<{ status?: string }>({
    host: "verify",
    method: "POST",
    path: `/v2/Services/${verifyServiceSid()}/VerificationCheck`,
    params: { To: to, Code: code.trim() },
  });
  if ((result.status ?? "").toLowerCase() !== "approved") {
    throw new Error("That code didn't match. Request a new one and try again.");
  }
  const admin = await adminClient();
  const { error } = await admin.from("phone_verifications").upsert(
    {
      user_id: userId,
      phone_e164: to,
      status: "approved",
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
  await admin.from("profiles").update({ agent_phone: to }).eq("id", userId);
  return { phone: to, status: "approved" as const };
}

function slugFor(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || "workspace"}-${suffix}`;
}

export type CreateWorkspaceInput = {
  name: string;
  website?: string | null;
  hours?: string | null;
};

export async function createWorkspace(userId: string, input: CreateWorkspaceInput) {
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Give your workspace a name.");
  const admin = await adminClient();
  const { data: verification } = await admin
    .from("phone_verifications")
    .select("phone_e164, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (verification?.["status"] !== "approved") {
    throw new Error("Verify your mobile number before creating the workspace.");
  }
  const phone = verification["phone_e164"] as string;
  const website = input.website?.trim() || null;
  const hours = input.hours?.trim() || null;
  const greeting = prefillAiGreeting({ businessName: name, website, hours });

  const { resolveWorkspaceForUser, recordActivation } = await import("./workspace.server");
  const existing = await resolveWorkspaceForUser(userId);
  if (existing) {
    await admin
      .from("workspaces")
      .update({
        name,
        business_name: name,
        website,
        hours,
        ai_greeting: greeting,
        verified_phone: phone,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    await admin
      .from("subscriptions")
      .update({ workspace_id: existing.id })
      .eq("user_id", userId)
      .is("workspace_id", null);
    return {
      id: existing.id,
      name,
      role: existing.role,
      aiGreeting: greeting,
      created: false,
    };
  }

  const { data: created, error } = await admin
    .from("workspaces")
    .insert({
      name,
      slug: slugFor(name),
      business_name: name,
      website,
      hours,
      ai_greeting: greeting,
      verified_phone: phone,
    })
    .select("id")
    .single();
  if (error || !created) throw new Error(error?.message ?? "Could not create the workspace.");
  const workspaceId = created["id"] as string;

  const { error: memberError } = await admin.from("workspace_members").insert({
    workspace_id: workspaceId,
    user_id: userId,
    role: "owner",
  });
  if (memberError) throw new Error(memberError.message);

  const { seedTrialEntitlements } = await import("./entitlements.server");
  await seedTrialEntitlements(workspaceId);
  await recordActivation(workspaceId, "signup", { userId });

  try {
    const { provisionWorkspaceTelephony } = await import("./twilio-provision.server");
    await provisionWorkspaceTelephony(workspaceId, { friendlyName: name });
  } catch (provisionError) {
    console.error("workspace telephony provision failed", provisionError);
  }

  await admin
    .from("profiles")
    .update({ workspace_name: name, agent_phone: phone })
    .eq("id", userId);
  await admin
    .from("subscriptions")
    .update({ workspace_id: workspaceId })
    .eq("user_id", userId)
    .is("workspace_id", null);

  return { id: workspaceId, name, role: "owner" as const, aiGreeting: greeting, created: true };
}

export async function onboardingState(userId: string) {
  const admin = await adminClient();
  const { resolveWorkspaceForUser } = await import("./workspace.server");
  const [workspace, verification] = await Promise.all([
    resolveWorkspaceForUser(userId),
    admin
      .from("phone_verifications")
      .select("phone_e164, status")
      .eq("user_id", userId)
      .maybeSingle()
      .then((result) => result.data),
  ]);
  return {
    phone: (verification?.["phone_e164"] as string | null) ?? null,
    phoneVerified: verification?.["status"] === "approved",
    workspace: workspace
      ? {
          id: workspace.id,
          name: workspace.name,
          website: workspace.website,
          hours: workspace.hours,
          aiGreeting: workspace.aiGreeting,
        }
      : null,
  };
}
