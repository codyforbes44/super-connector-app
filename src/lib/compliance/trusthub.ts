/**
 * Trust Hub payloads for caller trust.
 *
 * Policy SIDs are Twilio's fixed Trust Hub policies:
 * - Secondary Customer Profile (same bundle A2P already uses)
 * - SHAKEN/STIR trust product
 * - CNAM trust product
 * - Voice Integrity trust product
 *
 * Nothing here calls Twilio. Live submission stays behind an explicit env flag
 * that this repository does not set.
 */

export const TRUST_POLICIES = {
  secondaryCustomerProfile: "RNdfbf3fae0e1107f8aded0e7cead80bf5",
  shakenStir: "RN7a97559effdf62d00f4298208492a5ea",
  cnam: "RNf3db3cd1fe25fcfd3c3ded065c8fea53",
  voiceIntegrity: "RN5b3660f9598883b1df4e77f77acefba0",
} as const;

export const TRUST_FEES = {
  shakenStir: "No Twilio registration fee. Vetting usually takes 24 to 48 hours.",
  cnam: "No separate Twilio monthly fee to register the display name. CNAM needs an EIN or a DUNS number. Many mobile plans hide caller name unless the recipient turns it on, and the name the carrier shows can take several days.",
  voiceIntegrity:
    "No Twilio fee. Voice Integrity is a reputation signal that can reduce Spam Likely labels. It does not guarantee how a carrier labels the call.",
  brandedCalling:
    "Branded Calling is in public beta at $0.12 per call. SixVox does not submit it in this release.",
} as const;

export const VOICE_INTEGRITY_USE_CASES = [
  "Customer Support",
  "Appointment Reminders",
  "Delivery Notifications",
  "Informational",
  "Mixed",
  "Survey",
] as const;

export type BusinessIdType = "EIN" | "DUNS" | "none";

export type A2pBusinessSnapshot = {
  legalName?: string;
  businessType?: string;
  industry?: string;
  registrationNumber?: string;
  website?: string;
  street?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  contactFirstName?: string;
  contactLastName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactTitle?: string;
};

export type TrustHubDraft = {
  business: A2pBusinessSnapshot;
  customerProfileSid: string | null;
  businessIdType: BusinessIdType;
  cnamDisplayName: string;
  voiceIntegrityUseCase: string;
  employeeCount: number;
  dailyCallVolume: number;
  includeShakenStir: boolean;
  includeCnam: boolean;
  includeVoiceIntegrity: boolean;
};

export function inferBusinessIdType(registrationNumber: string | undefined): BusinessIdType {
  const value = (registrationNumber ?? "").trim();
  if (!value) return "none";
  if (/^\d{9}$/.test(value)) return "DUNS";
  if (/^\d{2}-?\d{7}$/.test(value)) return "EIN";
  return "EIN";
}

export function cnamEligible(idType: BusinessIdType): boolean {
  return idType === "EIN" || idType === "DUNS";
}

export function normalizeCnamDisplayName(value: string): string {
  return value
    .replace(/[^A-Za-z0-9 .,&'-]/g, "")
    .trim()
    .slice(0, 15);
}

export type TrustHubCall =
  | {
      kind: "customer_profile";
      method: "POST";
      path: "/v1/CustomerProfiles";
      params: Record<string, string>;
    }
  | {
      kind: "trust_product";
      product: "shaken_stir" | "cnam" | "voice_integrity";
      method: "POST";
      path: "/v1/TrustProducts";
      params: Record<string, string>;
    }
  | {
      kind: "end_user";
      product: "cnam" | "voice_integrity";
      method: "POST";
      path: "/v1/EndUsers";
      params: Record<string, string>;
    }
  | {
      kind: "entity_assignment";
      product: "shaken_stir" | "cnam" | "voice_integrity";
      method: "POST";
      path: string;
      params: Record<string, string>;
    };

export function buildTrustHubCalls(draft: TrustHubDraft): TrustHubCall[] {
  const business = draft.business;
  const email = business.contactEmail ?? "";
  const legalName = business.legalName ?? "Business";
  const calls: TrustHubCall[] = [];

  if (!draft.customerProfileSid) {
    calls.push({
      kind: "customer_profile",
      method: "POST",
      path: "/v1/CustomerProfiles",
      params: {
        FriendlyName: legalName,
        Email: email,
        PolicySid: TRUST_POLICIES.secondaryCustomerProfile,
      },
    });
  }

  if (draft.includeShakenStir) {
    calls.push({
      kind: "trust_product",
      product: "shaken_stir",
      method: "POST",
      path: "/v1/TrustProducts",
      params: {
        FriendlyName: `${legalName} SHAKEN/STIR`,
        Email: email,
        PolicySid: TRUST_POLICIES.shakenStir,
      },
    });
  }

  if (draft.includeCnam) {
    if (!cnamEligible(draft.businessIdType)) {
      throw new Error("CNAM needs an EIN or a DUNS number on the business profile.");
    }
    const display = normalizeCnamDisplayName(draft.cnamDisplayName);
    if (display.length < 1) throw new Error("Enter a CNAM display name (15 characters max).");
    calls.push({
      kind: "trust_product",
      product: "cnam",
      method: "POST",
      path: "/v1/TrustProducts",
      params: {
        FriendlyName: `${legalName} CNAM`,
        Email: email,
        PolicySid: TRUST_POLICIES.cnam,
      },
    });
    calls.push({
      kind: "end_user",
      product: "cnam",
      method: "POST",
      path: "/v1/EndUsers",
      params: {
        FriendlyName: `${legalName} CNAM`,
        Type: "cnam_information",
        "Attributes.cnam_display_name": display,
      },
    });
  }

  if (draft.includeVoiceIntegrity) {
    if (!draft.voiceIntegrityUseCase.trim()) {
      throw new Error("Pick a Voice Integrity use case.");
    }
    calls.push({
      kind: "trust_product",
      product: "voice_integrity",
      method: "POST",
      path: "/v1/TrustProducts",
      params: {
        FriendlyName: `${legalName} Voice Integrity`,
        Email: email,
        PolicySid: TRUST_POLICIES.voiceIntegrity,
      },
    });
    calls.push({
      kind: "end_user",
      product: "voice_integrity",
      method: "POST",
      path: "/v1/EndUsers",
      params: {
        FriendlyName: `${legalName} Voice Integrity`,
        Type: "voice_integrity_information",
        "Attributes.use_case": draft.voiceIntegrityUseCase,
        "Attributes.business_employee_count": String(draft.employeeCount),
        "Attributes.average_business_day_call_volume": String(draft.dailyCallVolume),
      },
    });
  }

  return calls;
}

/** Live Trust Hub writes stay off unless this exact value is set in the environment. */
export const TRUSTHUB_LIVE_ENV = "SIXVOX_ALLOW_TRUSTHUB_SUBMIT";
export const TRUSTHUB_LIVE_VALUE = "confirm-live-submit";

export function trustHubLiveSubmitEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[TRUSTHUB_LIVE_ENV] === TRUSTHUB_LIVE_VALUE;
}

export function assertTrustHubReady(input: {
  ownerConfirmed: boolean;
  env?: NodeJS.ProcessEnv;
}): "saved" | "submit" {
  if (!input.ownerConfirmed) {
    throw new Error("The account owner has to confirm this Trust Hub submission first.");
  }
  if (!trustHubLiveSubmitEnabled(input.env)) return "saved";
  return "submit";
}
