import { FEATURE_FLAGS, type FeatureFlag } from "@/lib/feature-flags";

export type PlanCode = "solo" | "team" | "scale";
export type BillingInterval = "month" | "year";

/** Free trial length applied to every new subscription. */
export const TRIAL_DAYS = 14;

/**
 * Trial allowances. Prices are not involved — change plan dollars on each
 * plan's `monthly` / `yearly` lines below.
 */
export const TRIAL_LIMITS = {
  numbers: 1,
  seats: 1,
  aiCalls: 20,
} as const;

export type PlanFeature = {
  label: string;
  /** When set and the flag is off, the UI shows a coming-soon badge. */
  flag?: FeatureFlag;
};

export type PlanMeta = {
  code: PlanCode;
  name: string;
  tagline: string;
  /** USD per month. Edit this number to change the displayed price. */
  monthly: number;
  /** USD per year. Edit this number to change the displayed price. */
  yearly: number;
  numbers: number;
  seats: number;
  /** Included AI receptionist calls per month. */
  aiCalls: number;
  features: PlanFeature[];
  highlighted?: boolean;
};

const textBack: PlanFeature = {
  label: "Missed-call text-back",
  flag: "missedCallTextBack",
};

const sharedSoloFeatures: PlanFeature[] = [
  { label: "AI receptionist on your line" },
  textBack,
  { label: "SMS, MMS, and in-app calling" },
  { label: "Voicemail with transcription" },
  { label: "A2P texting registration handled for you" },
  { label: "Push and email alerts" },
];

/**
 * Display prices stay at the amounts already in the app. Stripe price IDs are
 * derived by priceIdFor() and must keep matching the existing Stripe prices.
 * Change a dollar amount on the `monthly` or `yearly` line for that plan.
 */
export const PLANS: PlanMeta[] = [
  {
    code: "solo",
    name: "Solo",
    tagline: "Your line, answered when you're on a job.",
    monthly: 29,
    yearly: 290,
    numbers: 1,
    seats: 1,
    aiCalls: 50,
    features: [
      { label: "1 business number" },
      { label: "1 seat" },
      { label: "50 AI receptionist calls included" },
      ...sharedSoloFeatures,
    ],
  },
  {
    code: "team",
    name: "Team",
    tagline: "One inbox for a crew of up to five.",
    monthly: 59,
    yearly: 590,
    numbers: 3,
    seats: 5,
    aiCalls: 200,
    highlighted: true,
    features: [
      { label: "3 business numbers" },
      { label: "5 seats" },
      { label: "200 AI receptionist calls included" },
      { label: "Shared inbox with assignment" },
      ...sharedSoloFeatures,
    ],
  },
  {
    code: "scale",
    name: "Scale",
    tagline: "More numbers and seats as the crew grows.",
    monthly: 129,
    yearly: 1290,
    numbers: 10,
    seats: 20,
    aiCalls: 600,
    features: [
      { label: "10 business numbers" },
      { label: "20 seats" },
      { label: "600 AI receptionist calls included" },
      { label: "Shared inbox with assignment" },
      ...sharedSoloFeatures,
    ],
  },
];

export function planByCode(code?: string | null): PlanMeta | undefined {
  return PLANS.find((p) => p.code === code);
}

export function priceIdFor(code: PlanCode, interval: BillingInterval): string {
  return `${code}_${interval === "month" ? "monthly" : "yearly"}`;
}

/** "team_yearly" -> { plan: "team", interval: "year" } */
export function parsePriceId(priceId?: string | null): {
  plan: PlanCode | null;
  interval: BillingInterval;
} {
  const [code, cadence] = (priceId ?? "").split("_");
  const plan = PLANS.find((p) => p.code === code)?.code ?? null;
  return { plan, interval: cadence === "yearly" ? "year" : "month" };
}

/** Seat cap stored by the Stripe webhook. Scale is 20, not unlimited. */
export function seatsFor(code: PlanCode | null): number {
  const plan = planByCode(code);
  return plan?.seats ?? TRIAL_LIMITS.seats;
}

export function featureIsSoon(feature: PlanFeature): boolean {
  return feature.flag ? !FEATURE_FLAGS[feature.flag] : false;
}

export function featureLabel(feature: PlanFeature): string {
  return featureIsSoon(feature) ? `${feature.label} (coming soon)` : feature.label;
}

function matrixValue(flag: FeatureFlag): string {
  return FEATURE_FLAGS[flag] ? "Yes" : "Coming soon";
}

export const FEATURE_MATRIX: Array<{ label: string; solo: string; team: string; scale: string }> = [
  { label: "Phone numbers", solo: "1", team: "3", scale: "10" },
  { label: "Seats", solo: "1", team: "5", scale: "20" },
  { label: "Included AI receptionist calls", solo: "50", team: "200", scale: "600" },
  { label: "AI receptionist", solo: "Yes", team: "Yes", scale: "Yes" },
  {
    label: "Missed-call text-back",
    solo: matrixValue("missedCallTextBack"),
    team: matrixValue("missedCallTextBack"),
    scale: matrixValue("missedCallTextBack"),
  },
  { label: "SMS, MMS and voice", solo: "Yes", team: "Yes", scale: "Yes" },
  { label: "Included AI calls", solo: "50", team: "200", scale: "600" },
  { label: "Voicemail + transcription", solo: "Yes", team: "Yes", scale: "Yes" },
  { label: "In-app calling", solo: "Yes", team: "Yes", scale: "Yes" },
  { label: "International calling", solo: "—", team: "Yes", scale: "Yes" },
  { label: "Shared inbox + assignment", solo: "—", team: "Yes", scale: "Yes" },
  { label: "A2P texting registration", solo: "Handled", team: "Handled", scale: "Handled" },
];

export const POSITIONING_LINE =
  "Your business line that picks up when you can't, books the job, and texts back every missed caller, for about the cost of a phone plan.";

/** Must stay verbatim — voice-answer.test.ts checks this sentence in marketing copy. */
export const RECORDING_CLAIM =
  "Calls are only recorded if you turn on transcription for a line, and callers hear a recording notice first.";
