/**
 * Request bodies for Twilio's ISV A2P registration APIs.
 * Shapes follow the published guides (fetched 2026-09-26):
 * - Standard / Low-Volume: https://www.twilio.com/docs/messaging/compliance/a2p-10dlc/onboarding-isv-api
 * - Sole Proprietor: https://www.twilio.com/docs/messaging/compliance/a2p-10dlc/onboarding-isv-api-sole-prop-new
 * Low-Volume Standard is a Standard brand created with SkipAutomaticSecVet=true.
 * Do not send BrandType on that call; the low-volume sample omits it.
 */

export const SECONDARY_CUSTOMER_PROFILE_POLICY = "RNdfbf3fae0e1107f8aded0e7cead80bf5";
/** Current ISV TrustProduct policy. The older SID in the first in-app flow is not this one. */
export const A2P_TRUST_PRODUCT_POLICY = "RNb0d4771c2c98518d916a3d4cd70a8f8b";
export const SOLE_PROP_STARTER_PROFILE_POLICY = "RN806dd6cd175f314e1f96a9727ee271f4";
export const SOLE_PROP_TRUST_PRODUCT_POLICY = "RN670d5d2e282a6130ae063b234b6019c8";

export type LowVolumeBusiness = {
  legalName: string;
  businessType: string;
  industry: string;
  registrationNumber: string;
  website: string;
  regions?: string;
};

export function secondaryBusinessEndUser(input: LowVolumeBusiness): Record<string, string> {
  return {
    FriendlyName: `${input.legalName} business information`,
    Type: "customer_profile_business_information",
    "Attributes.business_name": input.legalName,
    "Attributes.business_type": input.businessType,
    "Attributes.business_registration_identifier": "EIN",
    "Attributes.business_registration_number": input.registrationNumber,
    "Attributes.business_identity": "direct_customer",
    "Attributes.business_industry": input.industry,
    "Attributes.website_url": input.website,
    "Attributes.business_regions_of_operation": input.regions ?? "USA_AND_CANADA",
  };
}

export function authorizedRepresentativeEndUser(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  title: string;
}): Record<string, string> {
  return {
    FriendlyName: `${input.firstName} ${input.lastName}`,
    Type: "authorized_representative_1",
    "Attributes.first_name": input.firstName,
    "Attributes.last_name": input.lastName,
    "Attributes.email": input.email,
    "Attributes.phone_number": input.phone,
    "Attributes.business_title": input.title,
    "Attributes.job_position": input.title,
  };
}

export function starterProfileEndUser(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}): Record<string, string> {
  return {
    FriendlyName: `${input.firstName} ${input.lastName} starter profile`,
    Type: "starter_customer_profile_information",
    "Attributes.first_name": input.firstName,
    "Attributes.last_name": input.lastName,
    "Attributes.email": input.email,
    "Attributes.phone_number": input.phone,
  };
}

export function solePropBrandEndUser(input: {
  brandName: string;
  mobilePhone: string;
  vertical: string;
}): Record<string, string> {
  return {
    FriendlyName: `${input.brandName} sole proprietor`,
    Type: "sole_proprietor_information",
    "Attributes.brand_name": input.brandName,
    "Attributes.mobile_phone_number": input.mobilePhone,
    "Attributes.vertical": input.vertical,
  };
}

export function privateCompanyMessagingProfile(): Record<string, string> {
  return {
    FriendlyName: "A2P messaging profile",
    Type: "us_a2p_messaging_profile_information",
    "Attributes.company_type": "private",
  };
}

/** Low-Volume Standard brand. SkipAutomaticSecVet is what makes it low-volume. */
export function lowVolumeBrandRegistration(input: {
  customerProfileBundleSid: string;
  a2pProfileBundleSid: string;
  mock: boolean;
}): Record<string, string | boolean> {
  const params: Record<string, string | boolean> = {
    CustomerProfileBundleSid: input.customerProfileBundleSid,
    A2PProfileBundleSid: input.a2pProfileBundleSid,
    SkipAutomaticSecVet: true,
  };
  if (input.mock) params["Mock"] = true;
  return params;
}

export function solePropBrandRegistration(input: {
  customerProfileBundleSid: string;
  a2pProfileBundleSid: string;
  mock: boolean;
}): Record<string, string | boolean> {
  const params: Record<string, string | boolean> = {
    CustomerProfileBundleSid: input.customerProfileBundleSid,
    A2PProfileBundleSid: input.a2pProfileBundleSid,
    BrandType: "SOLE_PROPRIETOR",
  };
  if (input.mock) params["Mock"] = true;
  return params;
}

export function customerProfileCreate(input: {
  friendlyName: string;
  statusEmail: string;
  policySid: string;
  statusCallback?: string;
}): Record<string, string> {
  const params: Record<string, string> = {
    FriendlyName: input.friendlyName,
    Email: input.statusEmail,
    PolicySid: input.policySid,
  };
  if (input.statusCallback) params["StatusCallback"] = input.statusCallback;
  return params;
}
