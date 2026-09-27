/**
 * Housecall Pro public API. API keys are MAX-plan only.
 * Auth: Authorization header is the raw API key.
 * Customer: POST https://api.housecallpro.com/customers
 * Lead: POST https://api.housecallpro.com/leads
 */

export const HOUSECALL_API_BASE = "https://api.housecallpro.com";

export const HOUSECALL_MAX_PLAN_COPY =
  "Housecall Pro's public API is available only on the MAX plan. Basic and Essentials accounts cannot create customers or leads with an API key.";

export const HOUSECALL_ZAPIER_COPY =
  "If you are not on MAX, open Settings → Outbound webhooks. SixVox signs those events with HMAC-SHA256, including call.completed and lead.captured. Zapier or Make can use those events to create a Housecall Pro lead.";

export type HousecallCallInput = {
  firstName?: string | null | undefined;
  lastName?: string | null | undefined;
  phone: string;
  email?: string | null | undefined;
  company?: string | null | undefined;
  street?: string | null | undefined;
  city?: string | null | undefined;
  state?: string | null | undefined;
  zip?: string | null | undefined;
  summary: string;
};

export function housecallPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

export function buildHousecallCustomer(input: HousecallCallInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    first_name: input.firstName?.trim() || "Caller",
    last_name: input.lastName?.trim() || "Customer",
    mobile_number: housecallPhone(input.phone),
    notifications_enabled: true,
    lead_source: "SixVox",
    notes: input.summary.trim(),
    tags: ["sixvox"],
  };
  if (input.email?.trim()) body["email"] = input.email.trim();
  if (input.company?.trim()) body["company"] = input.company.trim();
  if (input.street?.trim()) {
    body["addresses"] = [
      {
        type: "service",
        street: input.street.trim(),
        street_line_2: "",
        city: input.city?.trim() || "",
        state: input.state?.trim() || "",
        zip: input.zip?.trim() || "",
        country: "US",
      },
    ];
  }
  return body;
}

export function buildHousecallLead(
  input: HousecallCallInput,
  customerId: string,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    customer_id: customerId,
    lead_source: "SixVox",
    note: input.summary.trim(),
    tags: ["sixvox"],
  };
  if (input.street?.trim()) {
    body["address"] = {
      street: input.street.trim(),
      street_line_2: "",
      city: input.city?.trim() || "",
      state: input.state?.trim() || "",
      zip: input.zip?.trim() || "",
    };
  }
  return body;
}
