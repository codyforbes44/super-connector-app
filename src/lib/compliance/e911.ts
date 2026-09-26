import { E911_MONTHLY_FEE_CENTS } from "./disclosure";

export type ServiceAddress = {
  customerName: string;
  street: string;
  streetSecondary?: string;
  city: string;
  region: string;
  postalCode: string;
  isoCountry: string;
};

export type SuggestedAddress = ServiceAddress & {
  friendlyName?: string;
};

/** Twilio emergency FriendlyName is limited to 32 characters. */
export function emergencyFriendlyName(customerName: string, phoneNumber: string): string {
  const raw = `${customerName} ${phoneNumber}`.replace(/\s+/g, " ").trim();
  return raw.slice(0, 32);
}

/**
 * POST /2010-04-01/Accounts/{AccountSid}/Addresses.json
 * EmergencyEnabled must be true. AutoCorrectAddress is false so a near-miss
 * returns error 21629 with a suggested address instead of a silent rewrite.
 */
export function buildEmergencyAddressParams(
  input: ServiceAddress & { phoneNumber: string },
): Record<string, string | boolean> {
  const params: Record<string, string | boolean> = {
    CustomerName: input.customerName.trim(),
    Street: input.street.trim(),
    City: input.city.trim(),
    Region: input.region.trim(),
    PostalCode: input.postalCode.trim(),
    IsoCountry: (input.isoCountry || "US").trim().toUpperCase(),
    FriendlyName: emergencyFriendlyName(input.customerName, input.phoneNumber),
    EmergencyEnabled: true,
    AutoCorrectAddress: false,
  };
  const secondary = input.streetSecondary?.trim();
  if (secondary) params["StreetSecondary"] = secondary;
  return params;
}

/**
 * POST .../IncomingPhoneNumbers/{Sid}.json
 * EmergencyStatus Active is what lets the number place emergency calls.
 */
export function buildEmergencyAssociationParams(addressSid: string): Record<string, string> {
  return {
    EmergencyAddressSid: addressSid,
    EmergencyStatus: "Active",
  };
}

export function assertEmergencyFeeConfirmed(confirmed: boolean): void {
  if (!confirmed) {
    throw new Error(
      "Confirm the $0.75 per number per month emergency calling fee before saving this address.",
    );
  }
}

function readField(chunk: string, key: string): string | undefined {
  const match = new RegExp(`(?:^|,\\s*)${key}:\\s*([^,|]+)`, "i").exec(chunk);
  const value = match?.[1]?.trim();
  return value || undefined;
}

/**
 * Error 21629 puts the suggested address in the message body:
 * "... | CustomerName: ACME, Street: 123 MAIN ST, Locality: AUSTIN, Region: TX, PostalCode: 78701, IsoCountry: US"
 * Several suggestions are separated by " | ".
 */
export function parseSuggestedAddresses(body: string): SuggestedAddress[] {
  const code = /"code"\s*:\s*(\d+)/.exec(body)?.[1];
  const message = /"message"\s*:\s*"([^"]*)"/.exec(body)?.[1] ?? body;
  if (code && code !== "21629" && !/suggested address/i.test(message)) return [];

  const chunks = message
    .split(/\s+\|\s+/)
    .map((part) => part.trim())
    .filter((part) => /Street:/i.test(part));

  const suggestions: SuggestedAddress[] = [];
  for (const chunk of chunks) {
    const street = readField(chunk, "Street");
    const city = readField(chunk, "Locality") ?? readField(chunk, "City");
    const region = readField(chunk, "Region");
    const postalCode = readField(chunk, "PostalCode");
    const customerName = readField(chunk, "CustomerName");
    if (!street || !city || !region || !postalCode || !customerName) continue;
    const friendlyName = readField(chunk, "FriendlyName");
    suggestions.push({
      customerName,
      street,
      city,
      region,
      postalCode,
      isoCountry: (readField(chunk, "IsoCountry") ?? "US").toUpperCase(),
      ...(friendlyName ? { friendlyName } : {}),
    });
  }
  return suggestions;
}

export function twilioErrorCode(body: string): number | null {
  const match = /"code"\s*:\s*(\d+)/.exec(body);
  return match ? Number(match[1]) : null;
}

export type OutboundBlock = "e911_acknowledgment" | null;

/** Outbound app calls stay blocked until this user has acknowledged 47 CFR 9.11. */
export function outboundCallBlock(acknowledged: boolean): OutboundBlock {
  return acknowledged ? null : "e911_acknowledgment";
}

export const E911_BLOCK_SAY =
  "Before you can place a call, open SixVox and acknowledge the 911 service limitations.";

export function feeCentsForRegistration(): number {
  return E911_MONTHLY_FEE_CENTS;
}
