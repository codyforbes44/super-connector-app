/**
 * US A2P 10DLC registration.
 *
 * Carriers block SMS from a 10-digit number unless the number sits in a
 * Messaging Service whose campaign is registered under an approved brand:
 *
 *   Business profile -> Brand -> Campaign -> Number in pool -> Approved
 *
 * Everything here runs against TrustHub v1 and Messaging v1, which are not on
 * the connector gateway, so they use the direct Account SID / Auth Token path.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { requireAdmin, requireOwner } from "./app.server";
import { twilioRequest } from "./twilio.server";

type SB = SupabaseClient;

/** Twilio's fixed policy identifiers for the two bundles we need. */
const SECONDARY_PROFILE_POLICY = "RNdfbf3fae0e1107f8aded0e7cead80bf5";
const A2P_PROFILE_POLICY = "RNb0d4771c2c98518d916a3d74643c9ffb";

export type BusinessInput = {
  legalName: string;
  businessType: string; // e.g. "Partnership", "Corporation", "Sole Proprietorship"
  industry: string; // e.g. "TECHNOLOGY"
  registrationNumber: string; // EIN / Tax ID
  website: string;
  street: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
  contactPhone: string;
  contactTitle: string;
};

export type CampaignInput = {
  messagingServiceSid: string;
  useCase: string; // e.g. "MIXED", "CUSTOMER_CARE", "2FA"
  description: string;
  messageFlow: string; // how end users opt in
  sampleOne: string;
  sampleTwo: string;
  hasEmbeddedLinks: boolean;
  hasEmbeddedPhone: boolean;
};

type Row = {
  id: string;
  user_id: string;
  business: Partial<BusinessInput>;
  campaign_input: Partial<CampaignInput>;
  messaging_service_sid: string | null;
  customer_profile_sid: string | null;
  end_user_sid: string | null;
  address_sid: string | null;
  document_sid: string | null;
  trust_product_sid: string | null;
  brand_sid: string | null;
  brand_status: string | null;
  campaign_sid: string | null;
  campaign_status: string | null;
  last_error: string | null;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SB;
}

async function loadRow(userId: string): Promise<Row | null> {
  const db = await admin();
  const { data } = await db.from("a2p_registrations").select("*").eq("user_id", userId).maybeSingle();
  return (data as Row | null) ?? null;
}

async function saveRow(userId: string, patch: Record<string, unknown>): Promise<Row> {
  const db = await admin();
  const { data, error } = await db
    .from("a2p_registrations")
    .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Row;
}

/* -------------------------------------------------------------- validation */

function requireFields(input: Record<string, unknown>, fields: string[]) {
  const missing = fields.filter((f) => {
    const v = input[f];
    return v === undefined || v === null || String(v).trim() === "";
  });
  if (missing.length > 0) {
    throw new Error(`Please fill in: ${missing.join(", ")}.`);
  }
}

/* ------------------------------------------------------------ trusthub bits */

/** The account's own (primary) business profile, required to vouch for ours. */
async function primaryProfileSid(): Promise<string | null> {
  const res = await twilioRequest<{ results?: Array<{ sid: string; status: string }> }>({
    host: "trusthub",
    path: "/v1/CustomerProfiles",
    params: { PolicySid: SECONDARY_PROFILE_POLICY, PageSize: 50 },
  }).catch(() => ({ results: [] as Array<{ sid: string; status: string }> }));
  const approved = (res.results ?? []).find((p) => p.status === "twilio-approved");
  return approved?.sid ?? res.results?.[0]?.sid ?? null;
}

async function assign(bundleSid: string, objectSid: string, kind: "CustomerProfiles" | "TrustProducts") {
  await twilioRequest({
    host: "trusthub",
    method: "POST",
    path: `/v1/${kind}/${bundleSid}/EntityAssignments`,
    params: { ObjectSid: objectSid },
  }).catch(() => null); // re-assigning an existing object is not an error for us
}

async function evaluateAndSubmit(
  bundleSid: string,
  policySid: string,
  kind: "CustomerProfiles" | "TrustProducts",
) {
  const evaluation = await twilioRequest<{ status?: string; results?: unknown }>({
    host: "trusthub",
    method: "POST",
    path: `/v1/${kind}/${bundleSid}/Evaluations`,
    params: { PolicySid: policySid },
  });
  if (evaluation.status !== "compliant") {
    throw new Error(
      "Twilio rejected these details as incomplete. Check the legal business name, Tax ID, address and contact, then submit again.",
    );
  }
  await twilioRequest({
    host: "trusthub",
    method: "POST",
    path: `/v1/${kind}/${bundleSid}`,
    params: { Status: "pending-review" },
  });
}

/* ------------------------------------------------------------ step 1: profile */

export async function submitBusinessProfile(supabase: SB, userId: string, input: BusinessInput) {
  await requireOwner(supabase, userId);
  requireFields(input as unknown as Record<string, unknown>, [
    "legalName",
    "businessType",
    "industry",
    "registrationNumber",
    "website",
    "street",
    "city",
    "region",
    "postalCode",
    "country",
    "contactFirstName",
    "contactLastName",
    "contactEmail",
    "contactPhone",
    "contactTitle",
  ]);

  const existing = await loadRow(userId);

  // Postal address lives on the account, then is wrapped in a supporting document.
  const address = await twilioRequest<{ sid: string }>({
    method: "POST",
    path: "/Addresses.json",
    params: {
      CustomerName: input.legalName,
      Street: input.street,
      City: input.city,
      Region: input.region,
      PostalCode: input.postalCode,
      IsoCountry: input.country,
      FriendlyName: `${input.legalName} — A2P`,
    },
  });

  const document = await twilioRequest<{ sid: string }>({
    host: "trusthub",
    method: "POST",
    path: "/v1/SupportingDocuments",
    params: {
      FriendlyName: `${input.legalName} address`,
      Type: "customer_profile_address",
      "Attributes.address_sids": address.sid,
    },
  });

  const endUser = await twilioRequest<{ sid: string }>({
    host: "trusthub",
    method: "POST",
    path: "/v1/EndUsers",
    params: {
      FriendlyName: input.legalName,
      Type: "customer_profile_business_information",
      "Attributes.business_name": input.legalName,
      "Attributes.business_type": input.businessType,
      "Attributes.business_registration_identifier": "EIN",
      "Attributes.business_registration_number": input.registrationNumber,
      "Attributes.business_identity": "direct_customer",
      "Attributes.business_industry": input.industry,
      "Attributes.website_url": input.website,
      "Attributes.business_regions_of_operation": "USA_AND_CANADA",
      "Attributes.social_media_profile_urls": "",
    },
  });

  const profile =
    existing?.customer_profile_sid ??
    (
      await twilioRequest<{ sid: string }>({
        host: "trusthub",
        method: "POST",
        path: "/v1/CustomerProfiles",
        params: {
          FriendlyName: input.legalName,
          Email: input.contactEmail,
          PolicySid: SECONDARY_PROFILE_POLICY,
        },
      })
    ).sid;

  const contact = await twilioRequest<{ sid: string }>({
    host: "trusthub",
    method: "POST",
    path: "/v1/EndUsers",
    params: {
      FriendlyName: `${input.contactFirstName} ${input.contactLastName}`,
      Type: "authorized_representative_1",
      "Attributes.job_position": input.contactTitle,
      "Attributes.last_name": input.contactLastName,
      "Attributes.phone_number": input.contactPhone,
      "Attributes.first_name": input.contactFirstName,
      "Attributes.email": input.contactEmail,
      "Attributes.business_title": input.contactTitle,
    },
  });

  await assign(profile, endUser.sid, "CustomerProfiles");
  await assign(profile, contact.sid, "CustomerProfiles");
  await assign(profile, document.sid, "CustomerProfiles");
  const primary = await primaryProfileSid();
  if (primary && primary !== profile) await assign(profile, primary, "CustomerProfiles");

  await evaluateAndSubmit(profile, SECONDARY_PROFILE_POLICY, "CustomerProfiles");

  return saveRow(userId, {
    business: input,
    customer_profile_sid: profile,
    end_user_sid: endUser.sid,
    address_sid: address.sid,
    document_sid: document.sid,
    last_error: null,
  });
}

/* -------------------------------------------------------------- step 2: brand */

export async function submitBrand(supabase: SB, userId: string) {
  await requireOwner(supabase, userId);
  const row = await loadRow(userId);
  if (!row?.customer_profile_sid) throw new Error("Submit your business profile first.");

  const trustProduct =
    row.trust_product_sid ??
    (
      await twilioRequest<{ sid: string }>({
        host: "trusthub",
        method: "POST",
        path: "/v1/TrustProducts",
        params: {
          FriendlyName: `${row.business.legalName ?? "Business"} A2P`,
          Email: row.business.contactEmail ?? "",
          PolicySid: A2P_PROFILE_POLICY,
        },
      })
    ).sid;

  const messagingProfile = await twilioRequest<{ sid: string }>({
    host: "trusthub",
    method: "POST",
    path: "/v1/EndUsers",
    params: {
      FriendlyName: `${row.business.legalName ?? "Business"} messaging profile`,
      Type: "us_a2p_messaging_profile_information",
      "Attributes.company_type": "private",
    },
  });

  await assign(trustProduct, messagingProfile.sid, "TrustProducts");
  await assign(trustProduct, row.customer_profile_sid, "TrustProducts");
  await evaluateAndSubmit(trustProduct, A2P_PROFILE_POLICY, "TrustProducts");

  const brand = await twilioRequest<{ sid: string; status?: string }>({
    host: "messaging",
    method: "POST",
    path: "/v1/a2p/BrandRegistrations",
    params: {
      CustomerProfileBundleSid: row.customer_profile_sid,
      A2PProfileBundleSid: trustProduct,
      BrandType: "STANDARD",
      SkipAutomaticSecVet: false,
    },
  });

  return saveRow(userId, {
    trust_product_sid: trustProduct,
    brand_sid: brand.sid,
    brand_status: brand.status ?? "PENDING",
    last_error: null,
  });
}

/* ----------------------------------------------------------- step 3: campaign */

export async function submitCampaign(supabase: SB, userId: string, input: CampaignInput) {
  await requireOwner(supabase, userId);
  const row = await loadRow(userId);
  if (!row?.brand_sid) throw new Error("Register your brand first.");
  requireFields(input as unknown as Record<string, unknown>, [
    "messagingServiceSid",
    "useCase",
    "description",
    "messageFlow",
    "sampleOne",
    "sampleTwo",
  ]);

  const campaign = await twilioRequest<{ sid: string; campaign_status?: string }>({
    host: "messaging",
    method: "POST",
    path: `/v1/Services/${input.messagingServiceSid}/Compliance/Usa2p`,
    params: {
      BrandRegistrationSid: row.brand_sid,
      Description: input.description,
      MessageFlow: input.messageFlow,
      MessageSamples: [input.sampleOne, input.sampleTwo],
      UsAppToPersonUsecase: input.useCase,
      HasEmbeddedLinks: input.hasEmbeddedLinks,
      HasEmbeddedPhone: input.hasEmbeddedPhone,
    },
  });

  return saveRow(userId, {
    campaign_input: input,
    messaging_service_sid: input.messagingServiceSid,
    campaign_sid: campaign.sid,
    campaign_status: campaign.campaign_status ?? "PENDING",
    last_error: null,
  });
}

/* -------------------------------------------------------------------- status */

export type A2pStatus = {
  business: { state: string; detail: string | null; input: Partial<BusinessInput> };
  brand: { state: string; detail: string | null; sid: string | null };
  campaign: {
    state: string;
    detail: string | null;
    sid: string | null;
    messagingServiceSid: string | null;
    input: Partial<CampaignInput>;
  };
  numbersInPool: number;
  ready: boolean;
  blocked: string | null;
  /** One-glance verdict for the status strip. */
  overall: "approved" | "in_review" | "blocked" | "not_started";
  /** Plain-English sentence explaining that verdict. */
  headline: string;
  /** What the owner should do next, or null when nothing is needed. */
  nextStep: string | null;
};

/** Trades-owner English for the three-step state machine. */
function summarize(
  business: string,
  brand: string,
  campaign: string,
  poolCount: number,
  blocked: string | null,
): Pick<A2pStatus, "overall" | "headline" | "nextStep"> {
  const states = [business, brand, campaign];
  if (blocked) {
    return {
      overall: "blocked",
      headline: "We couldn't reach the texting approval service just now.",
      nextStep: "Try again in a few minutes. Nothing you submitted was lost.",
    };
  }
  if (states.includes("failed")) {
    return {
      overall: "blocked",
      headline: "Your US texting approval was turned down and needs a fix.",
      nextStep: "Correct the step marked \u201cNeeds fixing\u201d below and send it again.",
    };
  }
  if (campaign === "approved") {
    if (poolCount === 0) {
      return {
        overall: "blocked",
        headline: "You're approved to text, but no number is attached yet.",
        nextStep: "Add one of your numbers to the approved texting group below.",
      };
    }
    return {
      overall: "approved",
      headline: "You're approved. Texts from your numbers reach US phones.",
      nextStep: null,
    };
  }
  if (states.every((x) => x === "todo")) {
    return {
      overall: "not_started",
      headline: "US phone companies block business texts until you're approved.",
      nextStep: "Start with step 1 below \u2014 it takes about five minutes.",
    };
  }
  return {
    overall: "in_review",
    headline: "Your US texting approval is being reviewed.",
    nextStep: "Nothing to do right now. Reviews usually finish in a day or two.",
  };
}

function stateOf(status: string | null | undefined, fallback: string): string {
  if (!status) return fallback;
  const s = status.toLowerCase();
  if (s.includes("approved") || s === "verified") return "approved";
  if (s.includes("fail") || s.includes("reject")) return "failed";
  return "pending";
}

/** Live registration status, refreshed from Twilio on every read. */
export async function a2pStatus(supabase: SB, userId: string): Promise<A2pStatus> {
  await requireAdmin(supabase, userId);
  const row = await loadRow(userId);

  let profileStatus: string | null = null;
  let profileDetail: string | null = null;
  let brandStatus: string | null = row?.brand_status ?? null;
  let brandDetail: string | null = null;
  let campaignStatus: string | null = row?.campaign_status ?? null;
  let campaignDetail: string | null = null;
  let poolCount = 0;
  let blocked: string | null = null;

  try {
    if (row?.customer_profile_sid) {
      const profile = await twilioRequest<{ status?: string }>({
        host: "trusthub",
        path: `/v1/CustomerProfiles/${row.customer_profile_sid}`,
      });
      profileStatus = profile.status ?? null;
    }
    if (row?.brand_sid) {
      const brand = await twilioRequest<{ status?: string; failure_reason?: string }>({
        host: "messaging",
        path: `/v1/a2p/BrandRegistrations/${row.brand_sid}`,
      });
      brandStatus = brand.status ?? brandStatus;
      brandDetail = brand.failure_reason ?? null;
    }
    if (row?.messaging_service_sid) {
      const [campaign, numbers] = await Promise.all([
        twilioRequest<{ campaign_status?: string; errors?: unknown[] }>({
          host: "messaging",
          path: `/v1/Services/${row.messaging_service_sid}/Compliance/Usa2p/${row.campaign_sid ?? ""}`,
        }).catch(() => null),
        twilioRequest<{ phone_numbers?: unknown[] }>({
          host: "messaging",
          path: `/v1/Services/${row.messaging_service_sid}/PhoneNumbers`,
          params: { PageSize: 50 },
        }).catch(() => ({ phone_numbers: [] })),
      ]);
      campaignStatus = campaign?.campaign_status ?? campaignStatus;
      const errs = campaign?.errors;
      if (Array.isArray(errs) && errs.length > 0) campaignDetail = JSON.stringify(errs[0]);
      poolCount = (numbers.phone_numbers ?? []).length;
    }
  } catch (error) {
    blocked = error instanceof Error ? error.message : "Could not reach the carrier just now.";
  }

  const campaignState = stateOf(campaignStatus, row?.campaign_sid ? "pending" : "todo");
  const businessState = row?.customer_profile_sid ? stateOf(profileStatus, "pending") : "todo";
  const brandState = row?.brand_sid ? stateOf(brandStatus, "pending") : "todo";
  const blockedMessage = blocked ?? row?.last_error ?? null;

  return {
    ...summarize(businessState, brandState, campaignState, poolCount, blockedMessage),
    business: {
      state: businessState,
      detail: profileStatus,
      input: row?.business ?? {},
    },
    brand: {
      state: brandState,
      detail: brandDetail ?? brandStatus,
      sid: row?.brand_sid ?? null,
    },
    campaign: {
      state: campaignState,
      detail: campaignDetail ?? campaignStatus,
      sid: row?.campaign_sid ?? null,
      messagingServiceSid: row?.messaging_service_sid ?? null,
      input: row?.campaign_input ?? {},
    },
    numbersInPool: poolCount,
    ready: campaignState === "approved" && poolCount > 0,
    blocked: blockedMessage,
  };
}
