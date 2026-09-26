import type { SupabaseClient } from "@supabase/supabase-js";

import {
  assertAiCallCapacity,
  assertInternationalAllowed,
  assertNumberCapacity,
  assertSeatCapacity,
  assertSmsVelocity,
  entitlementPlanForSubscription,
  isEntitlementPlan,
  limitsFor,
  type EntitlementPlan,
  type PlanLimits,
} from "./plan-limits";

type EntitlementRow = {
  plan_code: string;
  status: string;
  max_numbers: number;
  max_seats: number;
  included_ai_calls: number;
  ai_minute_cap: number | null;
  ai_calls_used: number;
  ai_minutes_used: number;
  allow_international: boolean;
  sms_per_hour: number;
};

async function adminClient(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

export function limitsFromRow(row: EntitlementRow | null, fallback: EntitlementPlan): PlanLimits {
  if (!row || !isEntitlementPlan(row.plan_code)) return limitsFor(fallback);
  return {
    plan: row.plan_code,
    maxNumbers: row.max_numbers,
    maxSeats: row.max_seats,
    includedAiCalls: row.included_ai_calls,
    aiMinuteCap: row.ai_minute_cap,
    allowInternational: row.allow_international,
    smsPerHour: row.sms_per_hour,
  };
}

async function readLimits(workspaceId: string): Promise<{
  limits: PlanLimits;
  aiCallsUsed: number;
  aiMinutesUsed: number;
}> {
  const admin = await adminClient();
  const { data } = await admin
    .from("workspace_entitlements")
    .select(
      "plan_code, status, max_numbers, max_seats, included_ai_calls, ai_minute_cap, ai_calls_used, ai_minutes_used, allow_international, sms_per_hour",
    )
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  const row = (data as EntitlementRow | null) ?? null;
  return {
    limits: limitsFromRow(row, "trial"),
    aiCallsUsed: row?.ai_calls_used ?? 0,
    aiMinutesUsed: row?.ai_minutes_used ?? 0,
  };
}

export async function seedTrialEntitlements(workspaceId: string): Promise<void> {
  const admin = await adminClient();
  const defaults = limitsFor("trial");
  const { data: configured } = await admin
    .from("plan_limits")
    .select(
      "max_numbers, max_seats, included_ai_calls, ai_minute_cap, allow_international, sms_per_hour",
    )
    .eq("plan_code", "trial")
    .maybeSingle();
  const limits = configured
    ? {
        max_numbers: configured["max_numbers"] as number,
        max_seats: configured["max_seats"] as number,
        included_ai_calls: configured["included_ai_calls"] as number,
        ai_minute_cap: (configured["ai_minute_cap"] as number | null) ?? defaults.aiMinuteCap,
        allow_international: configured["allow_international"] as boolean,
        sms_per_hour: configured["sms_per_hour"] as number,
      }
    : {
        max_numbers: defaults.maxNumbers,
        max_seats: defaults.maxSeats,
        included_ai_calls: defaults.includedAiCalls,
        ai_minute_cap: defaults.aiMinuteCap,
        allow_international: defaults.allowInternational,
        sms_per_hour: defaults.smsPerHour,
      };
  await admin.from("workspace_entitlements").upsert(
    {
      workspace_id: workspaceId,
      plan_code: "trial",
      status: "trialing",
      ...limits,
    },
    { onConflict: "workspace_id", ignoreDuplicates: true },
  );
}

export async function syncEntitlementsFromSubscription(input: {
  userId: string;
  planCode: string | null;
  status: string | null;
  stripeSubscriptionId: string | null;
}): Promise<void> {
  const { resolveWorkspaceForUser } = await import("./workspace.server");
  const workspace = await resolveWorkspaceForUser(input.userId);
  if (!workspace) return;
  const plan = entitlementPlanForSubscription({
    planCode: input.planCode,
    status: input.status,
  });
  const admin = await adminClient();
  const { data: configured } = await admin
    .from("plan_limits")
    .select(
      "max_numbers, max_seats, included_ai_calls, ai_minute_cap, allow_international, sms_per_hour",
    )
    .eq("plan_code", plan)
    .maybeSingle();
  const defaults = limitsFor(plan);
  const { data: current } = await admin
    .from("workspace_entitlements")
    .select("ai_calls_used, ai_minutes_used")
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  await admin.from("workspace_entitlements").upsert(
    {
      workspace_id: workspace.id,
      plan_code: plan,
      status: input.status ?? "trialing",
      max_numbers: (configured?.["max_numbers"] as number | undefined) ?? defaults.maxNumbers,
      max_seats: (configured?.["max_seats"] as number | undefined) ?? defaults.maxSeats,
      included_ai_calls:
        (configured?.["included_ai_calls"] as number | undefined) ?? defaults.includedAiCalls,
      ai_minute_cap:
        configured && "ai_minute_cap" in configured
          ? (configured["ai_minute_cap"] as number | null)
          : defaults.aiMinuteCap,
      allow_international:
        (configured?.["allow_international"] as boolean | undefined) ?? defaults.allowInternational,
      sms_per_hour: (configured?.["sms_per_hour"] as number | undefined) ?? defaults.smsPerHour,
      stripe_subscription_id: input.stripeSubscriptionId,
      ai_calls_used: (current?.["ai_calls_used"] as number | undefined) ?? 0,
      ai_minutes_used: (current?.["ai_minutes_used"] as number | undefined) ?? 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id" },
  );
}

export async function assertCanAddNumber(workspaceId: string): Promise<PlanLimits> {
  const admin = await adminClient();
  const { limits } = await readLimits(workspaceId);
  const { count } = await admin
    .from("phone_numbers")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  assertNumberCapacity({ limits, numbersInUse: count ?? 0 });
  return limits;
}

export async function assertCanAddSeat(workspaceId: string): Promise<void> {
  const admin = await adminClient();
  const { limits } = await readLimits(workspaceId);
  const { count } = await admin
    .from("workspace_members")
    .select("user_id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  assertSeatCapacity({ limits, seatsInUse: count ?? 0 });
}

export async function assertCanStartAiCall(workspaceId: string): Promise<boolean> {
  const usage = await readLimits(workspaceId);
  try {
    assertAiCallCapacity({
      limits: usage.limits,
      aiCallsUsed: usage.aiCallsUsed,
      aiMinutesUsed: usage.aiMinutesUsed,
    });
    return true;
  } catch {
    return false;
  }
}

export async function recordAiCall(workspaceId: string, minutes = 1): Promise<void> {
  const admin = await adminClient();
  const usage = await readLimits(workspaceId);
  await admin
    .from("workspace_entitlements")
    .update({
      ai_calls_used: usage.aiCallsUsed + 1,
      ai_minutes_used: usage.aiMinutesUsed + Math.max(1, minutes),
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", workspaceId);
}

export async function assertCanCallDestination(
  workspaceId: string,
  destinationE164: string,
): Promise<void> {
  const { limits } = await readLimits(workspaceId);
  assertInternationalAllowed({ limits, destinationE164 });
}

export async function assertCanSendSms(workspaceId: string): Promise<void> {
  const admin = await adminClient();
  const { limits } = await readLimits(workspaceId);
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("direction", "outbound")
    .gte("created_at", since);
  assertSmsVelocity({ limits, sentInLastHour: count ?? 0 });
}

export async function workspaceSmsPolicy(workspaceId: string): Promise<{
  grandfathered: boolean;
  campaignStatus: string | null;
}> {
  const admin = await adminClient();
  const [{ data: workspace }, { data: registration }] = await Promise.all([
    admin.from("workspaces").select("a2p_grandfathered").eq("id", workspaceId).maybeSingle(),
    admin
      .from("a2p_registrations")
      .select("campaign_status, grandfathered")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
  ]);
  return {
    grandfathered: Boolean(workspace?.["a2p_grandfathered"] || registration?.["grandfathered"]),
    campaignStatus: (registration?.["campaign_status"] as string | null) ?? null,
  };
}
