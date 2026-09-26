/**
 * Default plan entitlements. The database table `plan_limits` is the source
 * of truth at runtime so the owner can change caps without a deploy. These
 * defaults are what the Phase 1 migration seeds, and what the server uses if
 * that row is missing.
 *
 * Prices and Stripe products are intentionally not in this file.
 */

export const PLAN_CODES = ["trial", "solo", "team", "scale"] as const;
export type EntitlementPlan = (typeof PLAN_CODES)[number];

export type PlanLimits = {
  plan: EntitlementPlan;
  maxNumbers: number;
  maxSeats: number;
  includedAiCalls: number;
  /** Trial guardrail. Null means the call count is the only AI cap. */
  aiMinuteCap: number | null;
  allowInternational: boolean;
  smsPerHour: number;
};

export const DEFAULT_PLAN_LIMITS: Record<EntitlementPlan, PlanLimits> = {
  trial: {
    plan: "trial",
    maxNumbers: 1,
    maxSeats: 1,
    includedAiCalls: 20,
    aiMinuteCap: 60,
    allowInternational: false,
    smsPerHour: 30,
  },
  solo: {
    plan: "solo",
    maxNumbers: 1,
    maxSeats: 1,
    includedAiCalls: 50,
    aiMinuteCap: null,
    allowInternational: false,
    smsPerHour: 120,
  },
  team: {
    plan: "team",
    maxNumbers: 3,
    maxSeats: 5,
    includedAiCalls: 200,
    aiMinuteCap: null,
    allowInternational: true,
    smsPerHour: 400,
  },
  scale: {
    plan: "scale",
    maxNumbers: 10,
    maxSeats: 20,
    includedAiCalls: 600,
    aiMinuteCap: null,
    allowInternational: true,
    smsPerHour: 1000,
  },
};

export function isEntitlementPlan(value: string | null | undefined): value is EntitlementPlan {
  return value === "trial" || value === "solo" || value === "team" || value === "scale";
}

export function limitsFor(plan: EntitlementPlan): PlanLimits {
  return DEFAULT_PLAN_LIMITS[plan];
}

export class PlanLimitError extends Error {
  readonly code = "plan_limit";
  readonly limit: "numbers" | "seats" | "ai_calls" | "ai_minutes" | "international" | "sms";

  constructor(limit: PlanLimitError["limit"], message: string) {
    super(message);
    this.limit = limit;
    this.name = "PlanLimitError";
  }
}

export function nextPlan(plan: EntitlementPlan): EntitlementPlan | null {
  switch (plan) {
    case "trial":
      return "solo";
    case "solo":
      return "team";
    case "team":
      return "scale";
    case "scale":
      return null;
    default: {
      const unreachable: never = plan;
      return unreachable;
    }
  }
}

export function assertNumberCapacity(input: { limits: PlanLimits; numbersInUse: number }): void {
  if (input.numbersInUse >= input.limits.maxNumbers) {
    const upgrade = nextPlan(input.limits.plan);
    const upgradeText = upgrade
      ? ` Upgrade to ${upgrade[0]?.toUpperCase()}${upgrade.slice(1)} to add another.`
      : " Contact support if you need more than this plan includes.";
    throw new PlanLimitError(
      "numbers",
      `Your ${input.limits.plan} plan includes ${input.limits.maxNumbers} phone number${input.limits.maxNumbers === 1 ? "" : "s"}.${upgradeText}`,
    );
  }
}

export function assertSeatCapacity(input: { limits: PlanLimits; seatsInUse: number }): void {
  if (input.seatsInUse >= input.limits.maxSeats) {
    const upgrade = nextPlan(input.limits.plan);
    const upgradeText = upgrade
      ? ` Upgrade to ${upgrade[0]?.toUpperCase()}${upgrade.slice(1)} to add a seat.`
      : " Contact support if you need more seats.";
    throw new PlanLimitError(
      "seats",
      `Your ${input.limits.plan} plan includes ${input.limits.maxSeats} seat${input.limits.maxSeats === 1 ? "" : "s"}.${upgradeText}`,
    );
  }
}

export function assertAiCallCapacity(input: {
  limits: PlanLimits;
  aiCallsUsed: number;
  aiMinutesUsed: number;
}): void {
  if (input.aiCallsUsed >= input.limits.includedAiCalls) {
    throw new PlanLimitError(
      "ai_calls",
      `Your ${input.limits.plan} plan includes ${input.limits.includedAiCalls} AI-answered calls. Upgrade to keep the receptionist answering.`,
    );
  }
  if (input.limits.aiMinuteCap !== null && input.aiMinutesUsed >= input.limits.aiMinuteCap) {
    throw new PlanLimitError(
      "ai_minutes",
      `The trial includes ${input.limits.aiMinuteCap} AI minutes. Upgrade to keep the receptionist answering.`,
    );
  }
}

export function assertInternationalAllowed(input: {
  limits: PlanLimits;
  destinationE164: string;
}): void {
  const digits = input.destinationE164.replace(/[^\d+]/g, "");
  const international = digits.startsWith("+") && !digits.startsWith("+1");
  if (international && !input.limits.allowInternational) {
    throw new PlanLimitError(
      "international",
      "International calling isn't included on this plan. Upgrade to call outside the US and Canada.",
    );
  }
}

export function assertSmsVelocity(input: { limits: PlanLimits; sentInLastHour: number }): void {
  if (input.sentInLastHour >= input.limits.smsPerHour) {
    throw new PlanLimitError(
      "sms",
      `This plan can send ${input.limits.smsPerHour} texts an hour. Wait a bit, or upgrade for a higher limit.`,
    );
  }
}

/** Map a Stripe subscription status onto the entitlement plan we enforce. */
export function entitlementPlanForSubscription(input: {
  planCode: string | null;
  status: string | null;
}): EntitlementPlan {
  const status = (input.status ?? "").toLowerCase();
  const paid = status === "active" || status === "past_due";
  if (paid && isEntitlementPlan(input.planCode)) return input.planCode;
  return "trial";
}
