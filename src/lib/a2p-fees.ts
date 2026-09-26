/**
 * Carrier fees disclosed before an owner submits A2P registration.
 * Twilio bills these when the brand is submitted. Rejection does not refund
 * the vetting fee. Figures follow Twilio's published A2P price list
 * (brand $4.50, vetting $15, campaign from $1.50/mo standard or $2/mo sole prop).
 */

export const A2P_PATHS = ["sole_proprietor", "low_volume_standard"] as const;
export type A2pPath = (typeof A2P_PATHS)[number];

export type A2pFeeSchedule = {
  path: A2pPath;
  brandUsd: number;
  vettingUsd: number;
  monthlyFromUsd: number;
  summary: string;
};

export const A2P_FEE_SCHEDULE: Record<A2pPath, A2pFeeSchedule> = {
  sole_proprietor: {
    path: "sole_proprietor",
    brandUsd: 4.5,
    vettingUsd: 15,
    monthlyFromUsd: 2,
    summary:
      "Sole Proprietor costs $4.50 to register the brand, $15 for vetting, and $2 per month. It allows one campaign and one number, about 3,000 segments a day. There is no EIN. An LLC cannot use this path. These fees are charged when you submit and vetting is not refunded if it is declined.",
  },
  low_volume_standard: {
    path: "low_volume_standard",
    brandUsd: 4.5,
    vettingUsd: 15,
    monthlyFromUsd: 1.5,
    summary:
      "Low-Volume Standard costs $4.50 to register the brand, $15 for vetting, and from $1.50 per month. It requires an EIN. These fees are charged when you submit and vetting is not refunded if it is declined.",
  },
};

export function isA2pPath(value: string | null | undefined): value is A2pPath {
  return value === "sole_proprietor" || value === "low_volume_standard";
}

const EIN_BUSINESS_TYPES = [
  "limited liability corporation",
  "limited liability company",
  "llc",
  "corporation",
  "partnership",
  "co-operative",
  "cooperative",
  "non-profit corporation",
  "nonprofit",
];

/** LLCs and any business that supplies an EIN cannot register as Sole Proprietor. */
export function solePropIneligible(input: {
  businessType: string;
  registrationNumber: string;
}): string | null {
  const type = input.businessType.trim().toLowerCase();
  const ein = input.registrationNumber.replace(/\D/g, "");
  if (ein.length >= 9) {
    return "A business with an EIN has to use Low-Volume Standard. Sole Proprietor is only for operators with no EIN.";
  }
  if (EIN_BUSINESS_TYPES.some((name) => type === name || type.includes("llc"))) {
    return "An LLC or other registered business has an EIN and can't use Sole Proprietor. Choose Low-Volume Standard.";
  }
  return null;
}

export function assertFeeAcknowledged(confirmFees: boolean, path: A2pPath): void {
  if (confirmFees !== true) {
    throw new Error(
      `Confirm the carrier fees before submitting. ${A2P_FEE_SCHEDULE[path].summary}`,
    );
  }
}
