/**
 * Per-workspace US A2P 10DLC registration (Twilio ISV model).
 *
 * Secondary Customer Profile -> TrustProduct -> Brand -> Campaign.
 * Low-Volume Standard omits BrandType and sets SkipAutomaticSecVet.
 * Sole Proprietor uses the starter profile and BrandType SOLE_PROPRIETOR.
 * API calls authenticate as the workspace subaccount. The ISV primary
 * Business Profile SID and status email come from the environment.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  A2P_TRUST_PRODUCT_POLICY,
  SECONDARY_CUSTOMER_PROFILE_POLICY,
  SOLE_PROP_STARTER_PROFILE_POLICY,
  SOLE_PROP_TRUST_PRODUCT_POLICY,
  authorizedRepresentativeEndUser,
  customerProfileCreate,
  lowVolumeBrandRegistration,
  privateCompanyMessagingProfile,
  secondaryBusinessEndUser,
  solePropBrandEndUser,
  solePropBrandRegistration,
  starterProfileEndUser,
} from "./a2p-api";
import {
  A2P_FEE_SCHEDULE,
  assertFeeAcknowledged,
  isA2pPath,
  solePropIneligible,
  type A2pPath,
} from "./a2p-fees";
import { requireAdmin, requireOwner } from "./app.server";
import { appEnvironment } from "./runtime-env";
import { twilioRequest, type TwilioAccountAuth } from "./twilio.server";

type SB = SupabaseClient;

export type BusinessInput = {
  legalName: string;
  businessType: string;
  industry: string;
  registrationNumber: string;
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
  registrationPath?: A2pPath;
  confirmFees?: boolean;
};

export type CampaignInput = {
  messagingServiceSid: string;
  useCase: string;
  description: string;
  messageFlow: string;
  sampleOne: string;
  sampleTwo: string;
  hasEmbeddedLinks: boolean;
  hasEmbeddedPhone: boolean;
  confirmFees?: boolean;
};

type Row = {
  id: string;
  user_id: string;
  workspace_id?: string | null;
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
  registration_path?: string | null;
  grandfathered?: boolean | null;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SB;
}

async function loadRow(workspaceId: string): Promise<Row | null> {
  const db = await admin();
  const { data } = await db
    .from("a2p_registrations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return (data as Row | null) ?? null;
}

async function saveRow(
  userId: string,
  workspaceId: string,
  patch: Record<string, unknown>,
): Promise<Row> {
  const db = await admin();
  const { data, error } = await db
    .from("a2p_registrations")
    .upsert(
      { user_id: userId, workspace_id: workspaceId, ...patch },
      { onConflict: "workspace_id" },
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Row;
}

function requireFields(input: Record<string, unknown>, fields: string[]) {
  const missing = fields.filter((field) => {
    const value = input[field];
    return value === undefined || value === null || String(value).trim() === "";
  });
  if (missing.length > 0) {
    throw new Error(`Please fill in: ${missing.join(", ")}.`);
  }
}

function statusEmail(): string {
  const email = process.env["TWILIO_A2P_STATUS_EMAIL"]?.trim();
  if (!email) {
    throw new Error(
      "Set TWILIO_A2P_STATUS_EMAIL to the ISV address Twilio should notify. Customer email is not used on the profile.",
    );
  }
  return email;
}

function primaryProfileSid(): string {
  const sid = process.env["TWILIO_PRIMARY_CUSTOMER_PROFILE_SID"]?.trim();
  if (!sid) {
    throw new Error(
      "Set TWILIO_PRIMARY_CUSTOMER_PROFILE_SID to the Twilio-approved ISV primary Business Profile before submitting.",
    );
  }
  return sid;
}

function mockBrands(): boolean {
  return appEnvironment() !== "production" && process.env["TWILIO_A2P_MOCK"] === "true";
}

function pathOf(value: string | null | undefined): A2pPath {
  return isA2pPath(value) ? value : "low_volume_standard";
}

async function workspaceAccount(userId: string) {
  const { requireWorkspaceOwner } = await import("./workspace.server");
  const { twilioAccountForWorkspace } = await import("./twilio-provision.server");
  const workspace = await requireWorkspaceOwner(userId);
  const creds = await twilioAccountForWorkspace(workspace.id);
  const account: TwilioAccountAuth = {
    accountSid: creds.accountSid,
    authToken: creds.authToken,
  };
  return { workspace, account, messagingServiceSid: creds.messagingServiceSid };
}

async function assign(
  account: TwilioAccountAuth,
  bundleSid: string,
  objectSid: string,
  kind: "CustomerProfiles" | "TrustProducts",
) {
  await twilioRequest({
    account,
    host: "trusthub",
    method: "POST",
    path: `/v1/${kind}/${bundleSid}/EntityAssignments`,
    params: { ObjectSid: objectSid },
  }).catch(() => null);
}

async function evaluateAndSubmit(
  account: TwilioAccountAuth,
  bundleSid: string,
  policySid: string,
  kind: "CustomerProfiles" | "TrustProducts",
) {
  const evaluation = await twilioRequest<{ status?: string }>({
    account,
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
    account,
    host: "trusthub",
    method: "POST",
    path: `/v1/${kind}/${bundleSid}`,
    params: { Status: "pending-review" },
  });
}

export async function submitBusinessProfile(supabase: SB, userId: string, input: BusinessInput) {
  await requireOwner(supabase, userId);
  const { workspace, account } = await workspaceAccount(userId);
  const path = pathOf(input.registrationPath);
  assertFeeAcknowledged(input.confirmFees === true, path);
  if (path === "sole_proprietor") {
    const blocked = solePropIneligible({
      businessType: input.businessType,
      registrationNumber: input.registrationNumber,
    });
    if (blocked) throw new Error(blocked);
  }

  const shared = [
    "legalName",
    "street",
    "city",
    "region",
    "postalCode",
    "country",
    "contactFirstName",
    "contactLastName",
    "contactEmail",
    "contactPhone",
  ];
  const extra =
    path === "low_volume_standard"
      ? ["businessType", "industry", "registrationNumber", "website", "contactTitle"]
      : [];
  requireFields(input as unknown as Record<string, unknown>, [...shared, ...extra]);

  const existing = await loadRow(workspace.id);
  const email = statusEmail();

  const address = await twilioRequest<{ sid: string }>({
    account,
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
    account,
    host: "trusthub",
    method: "POST",
    path: "/v1/SupportingDocuments",
    params: {
      FriendlyName: `${input.legalName} address`,
      Type: "customer_profile_address",
      "Attributes.address_sids": address.sid,
    },
  });

  const policy =
    path === "sole_proprietor"
      ? SOLE_PROP_STARTER_PROFILE_POLICY
      : SECONDARY_CUSTOMER_PROFILE_POLICY;
  const endUserParams =
    path === "sole_proprietor"
      ? starterProfileEndUser({
          firstName: input.contactFirstName,
          lastName: input.contactLastName,
          email: input.contactEmail,
          phone: input.contactPhone,
        })
      : secondaryBusinessEndUser({
          legalName: input.legalName,
          businessType: input.businessType,
          industry: input.industry,
          registrationNumber: input.registrationNumber,
          website: input.website,
        });

  const endUser = await twilioRequest<{ sid: string }>({
    account,
    host: "trusthub",
    method: "POST",
    path: "/v1/EndUsers",
    params: endUserParams,
  });

  const profile =
    existing?.customer_profile_sid ??
    (
      await twilioRequest<{ sid: string }>({
        account,
        host: "trusthub",
        method: "POST",
        path: "/v1/CustomerProfiles",
        params: customerProfileCreate({
          friendlyName: input.legalName,
          statusEmail: email,
          policySid: policy,
        }),
      })
    ).sid;

  await assign(account, profile, endUser.sid, "CustomerProfiles");
  await assign(account, profile, document.sid, "CustomerProfiles");
  if (path === "low_volume_standard") {
    const contact = await twilioRequest<{ sid: string }>({
      account,
      host: "trusthub",
      method: "POST",
      path: "/v1/EndUsers",
      params: authorizedRepresentativeEndUser({
        firstName: input.contactFirstName,
        lastName: input.contactLastName,
        email: input.contactEmail,
        phone: input.contactPhone,
        title: input.contactTitle,
      }),
    });
    await assign(account, profile, contact.sid, "CustomerProfiles");
  }
  const primary = primaryProfileSid();
  if (primary !== profile) await assign(account, profile, primary, "CustomerProfiles");
  await evaluateAndSubmit(account, profile, policy, "CustomerProfiles");

  return saveRow(userId, workspace.id, {
    business: input,
    registration_path: path,
    fee_acknowledged_at: new Date().toISOString(),
    customer_profile_sid: profile,
    end_user_sid: endUser.sid,
    address_sid: address.sid,
    document_sid: document.sid,
    last_error: null,
  });
}

export async function submitBrand(supabase: SB, userId: string, input: { confirmFees: boolean }) {
  await requireOwner(supabase, userId);
  const { workspace, account } = await workspaceAccount(userId);
  const row = await loadRow(workspace.id);
  if (!row?.customer_profile_sid) throw new Error("Submit your business profile first.");
  const path = pathOf(row.registration_path ?? row.business.registrationPath);
  assertFeeAcknowledged(input.confirmFees === true, path);
  const email = statusEmail();
  const policy =
    path === "sole_proprietor" ? SOLE_PROP_TRUST_PRODUCT_POLICY : A2P_TRUST_PRODUCT_POLICY;

  const trustProduct =
    row.trust_product_sid ??
    (
      await twilioRequest<{ sid: string }>({
        account,
        host: "trusthub",
        method: "POST",
        path: "/v1/TrustProducts",
        params: customerProfileCreate({
          friendlyName: `${row.business.legalName ?? "Business"} A2P`,
          statusEmail: email,
          policySid: policy,
        }),
      })
    ).sid;

  const messagingProfile = await twilioRequest<{ sid: string }>({
    account,
    host: "trusthub",
    method: "POST",
    path: "/v1/EndUsers",
    params:
      path === "sole_proprietor"
        ? solePropBrandEndUser({
            brandName: row.business.legalName ?? "Business",
            mobilePhone: row.business.contactPhone ?? "",
            vertical: row.business.industry || "PROFESSIONAL_SERVICES",
          })
        : privateCompanyMessagingProfile(),
  });

  await assign(account, trustProduct, messagingProfile.sid, "TrustProducts");
  await assign(account, trustProduct, row.customer_profile_sid, "TrustProducts");
  await evaluateAndSubmit(account, trustProduct, policy, "TrustProducts");

  const brandParams =
    path === "sole_proprietor"
      ? solePropBrandRegistration({
          customerProfileBundleSid: row.customer_profile_sid,
          a2pProfileBundleSid: trustProduct,
          mock: mockBrands(),
        })
      : lowVolumeBrandRegistration({
          customerProfileBundleSid: row.customer_profile_sid,
          a2pProfileBundleSid: trustProduct,
          mock: mockBrands(),
        });

  const brand = await twilioRequest<{ sid: string; status?: string }>({
    account,
    host: "messaging",
    method: "POST",
    path: "/v1/a2p/BrandRegistrations",
    params: brandParams,
  });

  return saveRow(userId, workspace.id, {
    trust_product_sid: trustProduct,
    brand_sid: brand.sid,
    brand_status: brand.status ?? "PENDING",
    registration_path: path,
    fee_acknowledged_at: new Date().toISOString(),
    last_error: null,
  });
}

export async function submitCampaign(supabase: SB, userId: string, input: CampaignInput) {
  await requireOwner(supabase, userId);
  const { workspace, account, messagingServiceSid } = await workspaceAccount(userId);
  const row = await loadRow(workspace.id);
  if (!row?.brand_sid) throw new Error("Register your brand first.");
  const path = pathOf(row.registration_path ?? row.business.registrationPath);
  assertFeeAcknowledged(input.confirmFees === true, path);
  const serviceSid = input.messagingServiceSid || messagingServiceSid || "";
  requireFields(
    { ...input, messagingServiceSid: serviceSid } as unknown as Record<string, unknown>,
    ["messagingServiceSid", "useCase", "description", "messageFlow", "sampleOne", "sampleTwo"],
  );

  const campaign = await twilioRequest<{ sid: string; campaign_status?: string }>({
    account,
    host: "messaging",
    method: "POST",
    path: `/v1/Services/${serviceSid}/Compliance/Usa2p`,
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

  return saveRow(userId, workspace.id, {
    campaign_input: input,
    messaging_service_sid: serviceSid,
    campaign_sid: campaign.sid,
    campaign_status: campaign.campaign_status ?? "PENDING",
    last_error: null,
  });
}

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
  overall: "approved" | "in_review" | "blocked" | "not_started";
  headline: string;
  nextStep: string | null;
  registrationPath: A2pPath;
  grandfathered: boolean;
  feeSummary: string;
};

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
      nextStep: "Correct the step marked “Needs fixing” below and send it again.",
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
  if (states.every((item) => item === "todo")) {
    return {
      overall: "not_started",
      headline: "US phone companies block business texts until you're approved.",
      nextStep: "Start with step 1 below — it takes about five minutes.",
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
  const value = status.toLowerCase();
  if (value.includes("approved") || value === "verified") return "approved";
  if (value.includes("fail") || value.includes("reject")) return "failed";
  return "pending";
}

export async function a2pStatus(supabase: SB, userId: string): Promise<A2pStatus> {
  await requireAdmin(supabase, userId);
  const { requireWorkspace } = await import("./workspace.server");
  const workspace = await requireWorkspace(userId);
  const row = await loadRow(workspace.id);
  const registrationPath = pathOf(row?.registration_path ?? row?.business.registrationPath);
  const feeSummary = A2P_FEE_SCHEDULE[registrationPath].summary;

  if (workspace.a2pGrandfathered || row?.grandfathered) {
    return {
      ...summarize("approved", "approved", "approved", 1, null),
      business: { state: "approved", detail: "grandfathered", input: row?.business ?? {} },
      brand: { state: "approved", detail: "grandfathered", sid: row?.brand_sid ?? null },
      campaign: {
        state: "approved",
        detail: "grandfathered",
        sid: row?.campaign_sid ?? null,
        messagingServiceSid: row?.messaging_service_sid ?? null,
        input: row?.campaign_input ?? {},
      },
      numbersInPool: 1,
      ready: true,
      blocked: null,
      registrationPath,
      grandfathered: true,
      feeSummary,
    };
  }

  let profileStatus: string | null = null;
  let brandStatus: string | null = row?.brand_status ?? null;
  let brandDetail: string | null = null;
  let campaignStatus: string | null = row?.campaign_status ?? null;
  let campaignDetail: string | null = null;
  let poolCount = 0;
  let blocked: string | null = null;

  try {
    const { twilioAccountForWorkspace } = await import("./twilio-provision.server");
    const creds = await twilioAccountForWorkspace(workspace.id);
    const account = { accountSid: creds.accountSid, authToken: creds.authToken };
    if (row?.customer_profile_sid) {
      const profile = await twilioRequest<{ status?: string }>({
        account,
        host: "trusthub",
        path: `/v1/CustomerProfiles/${row.customer_profile_sid}`,
      });
      profileStatus = profile.status ?? null;
    }
    if (row?.brand_sid) {
      const brand = await twilioRequest<{ status?: string; failure_reason?: string }>({
        account,
        host: "messaging",
        path: `/v1/a2p/BrandRegistrations/${row.brand_sid}`,
      });
      brandStatus = brand.status ?? brandStatus;
      brandDetail = brand.failure_reason ?? null;
    }
    if (row?.messaging_service_sid) {
      const [campaign, numbers] = await Promise.all([
        twilioRequest<{ campaign_status?: string; errors?: unknown[] }>({
          account,
          host: "messaging",
          path: `/v1/Services/${row.messaging_service_sid}/Compliance/Usa2p/${row.campaign_sid ?? ""}`,
        }).catch(() => null),
        twilioRequest<{ phone_numbers?: unknown[] }>({
          account,
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
    business: { state: businessState, detail: profileStatus, input: row?.business ?? {} },
    brand: { state: brandState, detail: brandDetail ?? brandStatus, sid: row?.brand_sid ?? null },
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
    registrationPath,
    grandfathered: false,
    feeSummary,
  };
}
