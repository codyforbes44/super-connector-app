import type { SupabaseClient } from "@supabase/supabase-js";

import { audit } from "@/lib/app.server";
import { TwilioError, twilioRequest } from "@/lib/twilio.server";

import { E911_DISCLOSURE_VERSION, E911_MONTHLY_FEE_CENTS } from "./disclosure";
import {
  assertEmergencyFeeConfirmed,
  buildEmergencyAddressParams,
  buildEmergencyAssociationParams,
  feeCentsForRegistration,
  parseSuggestedAddresses,
  type ServiceAddress,
  type SuggestedAddress,
} from "./e911";

type SB = SupabaseClient;

export type RegisterEmergencyInput = ServiceAddress & {
  phoneNumberSid: string;
  phoneNumber: string;
  confirmMonthlyFee: boolean;
  moved?: boolean;
};

export type RegisterEmergencyResult =
  | {
      ok: true;
      addressSid: string;
      emergencyStatus: string | null;
      emergencyAddressStatus: string | null;
      feeCents: number;
    }
  | {
      ok: false;
      suggestions: SuggestedAddress[];
      message: string;
    };

async function adminClient(): Promise<SB> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SB;
}

export async function userAcknowledgedE911(admin: SB, userId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("e911_acknowledgments")
    .select("id")
    .eq("user_id", userId)
    .eq("disclosure_version", E911_DISCLOSURE_VERSION)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function acknowledgeE911(supabase: SB, userId: string): Promise<{ ok: true }> {
  const admin = await adminClient();
  const { requireWorkspace } = await import("@/lib/workspace.server");
  const workspace = await requireWorkspace(userId);
  const { error } = await admin.from("e911_acknowledgments").upsert(
    {
      user_id: userId,
      disclosure_version: E911_DISCLOSURE_VERSION,
      acknowledged_at: new Date().toISOString(),
      workspace_id: workspace.id,
    },
    { onConflict: "user_id,disclosure_version" },
  );
  if (error) throw new Error(error.message);
  await audit(admin, userId, "e911.disclosure.acknowledge", {
    disclosure_version: E911_DISCLOSURE_VERSION,
    regulation: "47 CFR 9.11",
  });
  void supabase;
  return { ok: true };
}

export async function listEmergencyAddresses(admin: SB) {
  const { data, error } = await admin.from("emergency_addresses").select("*").order("phone_number");
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Creates a Twilio Address with EmergencyEnabled and associates it to the
 * number. Refuses to call Twilio until the owner confirms the monthly fee.
 */
export async function registerEmergencyAddress(
  userId: string,
  input: RegisterEmergencyInput,
): Promise<RegisterEmergencyResult> {
  assertEmergencyFeeConfirmed(input.confirmMonthlyFee);
  const { resolveWorkspaceIdForNumber, requireWorkspace } = await import("@/lib/workspace.server");
  const fromNumber = (await resolveWorkspaceIdForNumber(input.phoneNumber)).workspaceId;
  const workspaceId = fromNumber ?? (await requireWorkspace(userId)).id;
  const admin = await adminClient();

  const { data: existing } = await admin
    .from("emergency_addresses")
    .select("twilio_address_sid")
    .eq("phone_number_sid", input.phoneNumberSid)
    .maybeSingle();

  let addressSid: string;
  try {
    const created = await twilioRequest<{ sid: string; validated?: boolean }>({
      method: "POST",
      path: "/Addresses.json",
      params: buildEmergencyAddressParams(input),
    });
    addressSid = created.sid;
  } catch (error) {
    const body = error instanceof TwilioError ? error.body : "";
    const suggestions = parseSuggestedAddresses(body);
    if (suggestions.length) {
      await admin.from("emergency_addresses").upsert(
        {
          phone_number_sid: input.phoneNumberSid,
          phone_number: input.phoneNumber,
          customer_name: input.customerName,
          street: input.street,
          street_secondary: input.streetSecondary ?? null,
          city: input.city,
          region: input.region,
          postal_code: input.postalCode,
          iso_country: input.isoCountry || "US",
          emergency_enabled: false,
          validated: false,
          suggested_addresses: suggestions,
          created_by: userId,
          workspace_id: workspaceId,
        },
        { onConflict: "phone_number_sid" },
      );
      return {
        ok: false,
        suggestions,
        message:
          "Twilio could not validate that address for 911. Pick a suggested address or correct it and try again.",
      };
    }
    throw error;
  }

  const associated = await twilioRequest<{
    emergency_status?: string;
    emergency_address_status?: string;
  }>({
    method: "POST",
    path: `/IncomingPhoneNumbers/${input.phoneNumberSid}.json`,
    params: buildEmergencyAssociationParams(addressSid),
  });

  await admin.from("emergency_addresses").upsert(
    {
      phone_number_sid: input.phoneNumberSid,
      phone_number: input.phoneNumber,
      twilio_address_sid: addressSid,
      customer_name: input.customerName,
      street: input.street,
      street_secondary: input.streetSecondary ?? null,
      city: input.city,
      region: input.region,
      postal_code: input.postalCode,
      iso_country: input.isoCountry || "US",
      emergency_enabled: true,
      emergency_status: associated.emergency_status ?? "Active",
      emergency_address_status: associated.emergency_address_status ?? "pending-registration",
      validated: true,
      suggested_addresses: [],
      fee_acknowledged_at: new Date().toISOString(),
      fee_cents: feeCentsForRegistration(),
      moved_from_address_sid: input.moved
        ? ((existing?.twilio_address_sid as string | null) ?? null)
        : null,
      created_by: userId,
      workspace_id: workspaceId,
    },
    { onConflict: "phone_number_sid" },
  );

  await audit(admin, userId, input.moved ? "e911.address.move" : "e911.address.register", {
    phone_number_sid: input.phoneNumberSid,
    phone_number: input.phoneNumber,
    address_sid: addressSid,
    fee_cents: E911_MONTHLY_FEE_CENTS,
  });

  return {
    ok: true,
    addressSid,
    emergencyStatus: associated.emergency_status ?? "Active",
    emergencyAddressStatus: associated.emergency_address_status ?? "pending-registration",
    feeCents: E911_MONTHLY_FEE_CENTS,
  };
}
