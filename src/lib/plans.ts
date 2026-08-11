export type PlanCode = "solo" | "team" | "scale";
export type BillingInterval = "month" | "year";

/** Free trial length applied to every new subscription. */
export const TRIAL_DAYS = 14;

export type PlanMeta = {
  code: PlanCode;
  name: string;
  tagline: string;
  monthly: number;
  yearly: number;
  numbers: number;
  seats: number | null;
  features: string[];
  highlighted?: boolean;
};

export const PLANS: PlanMeta[] = [
  {
    code: "solo",
    name: "Solo",
    tagline: "One number, everything that matters.",
    monthly: 19,
    yearly: 190,
    numbers: 1,
    seats: 1,
    features: [
      "1 phone number",
      "1 seat",
      "SMS, MMS and calling",
      "Voicemail with transcription",
      "Call history and voicemail transcripts",
      "Push and email alerts",
    ],
  },
  {
    code: "team",
    name: "Team",
    tagline: "A shared inbox for the whole crew.",
    monthly: 59,
    yearly: 590,
    numbers: 3,
    seats: 5,
    highlighted: true,
    features: [
      "3 phone numbers",
      "5 seats",
      "Everything in Solo",
      "WhatsApp channel",
      "Shared inbox with assignment",
      "AI voicemail assistants",
      "Verify and Lookup",
      "Gmail, Calendar and Maps tools",
    ],
  },
  {
    code: "scale",
    name: "Scale",
    tagline: "Unrestricted telephony, no ceiling.",
    monthly: 129,
    yearly: 1290,
    numbers: 10,
    seats: null,
    features: [
      "10 phone numbers",
      "Unlimited seats",
      "Everything in Team",
      "Messaging Services and A2P",
      "Unrestricted API console",
      "Priority alerting",
      "Subaccount and usage insight",
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

export function seatsFor(code: PlanCode | null): number {
  const plan = planByCode(code);
  return plan?.seats ?? 999;
}

export const FEATURE_MATRIX: Array<{ label: string; solo: string; team: string; scale: string }> = [
  { label: "Phone numbers", solo: "1", team: "3", scale: "10" },
  { label: "Seats", solo: "1", team: "5", scale: "Unlimited" },
  { label: "SMS, MMS and voice", solo: "Yes", team: "Yes", scale: "Yes" },
  { label: "Voicemail + transcription", solo: "Yes", team: "Yes", scale: "Yes" },
  { label: "In-app calling", solo: "Yes", team: "Yes", scale: "Yes" },
  { label: "WhatsApp", solo: "—", team: "Yes", scale: "Yes" },
  { label: "Shared inbox + assignment", solo: "—", team: "Yes", scale: "Yes" },
  { label: "AI voicemail assistants", solo: "—", team: "Yes", scale: "Yes" },
  { label: "Verify and Lookup", solo: "—", team: "Yes", scale: "Yes" },
  { label: "Gmail, Calendar, Maps", solo: "—", team: "Yes", scale: "Yes" },
  { label: "Messaging Services / A2P", solo: "—", team: "—", scale: "Yes" },
  { label: "Unrestricted API console", solo: "—", team: "—", scale: "Yes" },
  { label: "Priority alerting", solo: "—", team: "—", scale: "Yes" },
];