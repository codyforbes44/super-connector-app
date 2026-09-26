import type { SupabaseClient } from "@supabase/supabase-js";

import { requireOwner, audit } from "@/lib/app.server";

import {
  assertTrustHubReady,
  buildTrustHubCalls,
  inferBusinessIdType,
  type A2pBusinessSnapshot,
  type BusinessIdType,
  type TrustHubDraft,
} from "./trusthub";

type SB = SupabaseClient;

export type TrustHubInput = {
  ownerConfirmed: boolean;
  cnamDisplayName: string;
  businessIdType: BusinessIdType;
  voiceIntegrityUseCase: string;
  employeeCount: number;
  dailyCallVolume: number;
  includeShakenStir: boolean;
  includeCnam: boolean;
  includeVoiceIntegrity: boolean;
};

async function adminClient(): Promise<SB> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SB;
}

export type TrustHubRegistrationSummary = {
  status: string | null;
  lastError: string | null;
  cnamDisplayName: string | null;
};

export async function loadTrustHubDraft(userId: string): Promise<{
  business: A2pBusinessSnapshot;
  customerProfileSid: string | null;
  registration: TrustHubRegistrationSummary | null;
}> {
  const admin = await adminClient();
  const [{ data: a2p }, { data: trust }] = await Promise.all([
    admin
      .from("a2p_registrations")
      .select("business, customer_profile_sid")
      .eq("user_id", userId)
      .maybeSingle(),
    admin.from("trust_hub_registrations").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  const business = (a2p?.["business"] ?? {}) as A2pBusinessSnapshot;
  const row = trust as {
    status?: string | null;
    last_error?: string | null;
    cnam_display_name?: string | null;
  } | null;
  return {
    business,
    customerProfileSid: (a2p?.["customer_profile_sid"] as string | null) ?? null,
    registration: row
      ? {
          status: row.status ?? null,
          lastError: row.last_error ?? null,
          cnamDisplayName: row.cnam_display_name ?? null,
        }
      : null,
  };
}

/**
 * Saves the owner's confirmed draft. Does not create Trust Hub bundles unless
 * SIXVOX_ALLOW_TRUSTHUB_SUBMIT=confirm-live-submit, which is not set here.
 */
export async function confirmTrustHub(supabase: SB, userId: string, input: TrustHubInput) {
  await requireOwner(supabase, userId);
  const mode = assertTrustHubReady({ ownerConfirmed: input.ownerConfirmed });
  const loaded = await loadTrustHubDraft(userId);
  const idType =
    input.businessIdType === "none"
      ? inferBusinessIdType(loaded.business.registrationNumber)
      : input.businessIdType;
  const draft: TrustHubDraft = {
    business: loaded.business,
    customerProfileSid: loaded.customerProfileSid,
    businessIdType: idType,
    cnamDisplayName: input.cnamDisplayName,
    voiceIntegrityUseCase: input.voiceIntegrityUseCase,
    employeeCount: input.employeeCount,
    dailyCallVolume: input.dailyCallVolume,
    includeShakenStir: input.includeShakenStir,
    includeCnam: input.includeCnam,
    includeVoiceIntegrity: input.includeVoiceIntegrity,
  };
  const calls = buildTrustHubCalls(draft);
  const admin = await adminClient();
  const { requireWorkspace } = await import("@/lib/workspace.server");
  const workspace = await requireWorkspace(userId);
  const { error } = await admin.from("trust_hub_registrations").upsert(
    {
      user_id: userId,
      workspace_id: workspace.id,
      customer_profile_sid: loaded.customerProfileSid,
      cnam_display_name: input.cnamDisplayName,
      business_id_type: idType,
      voice_integrity_use_case: input.voiceIntegrityUseCase,
      employee_count: input.employeeCount,
      daily_call_volume: input.dailyCallVolume,
      owner_confirmed_at: new Date().toISOString(),
      status: mode === "submit" ? "submitted" : "confirmed",
      last_error:
        mode === "submit"
          ? null
          : "Saved. Live Trust Hub submission is turned off, so nothing was sent to Twilio.",
      draft: { calls, products: draft },
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
  await audit(admin, userId, "trusthub.confirm", {
    mode,
    shaken: input.includeShakenStir,
    cnam: input.includeCnam,
    voice_integrity: input.includeVoiceIntegrity,
    reused_profile: Boolean(loaded.customerProfileSid),
  });
  if (mode === "submit") {
    throw new Error(
      "Live Trust Hub submission is not implemented in this release. The draft was saved and nothing was sent.",
    );
  }
  return {
    ok: true as const,
    submitted: false as const,
    message:
      "Saved. Nothing was submitted to Twilio. Turn on live submission in a later release after you review the fees.",
    calls,
  };
}
