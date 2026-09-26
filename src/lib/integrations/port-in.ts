/**
 * Twilio Port In API (public beta, US local numbers).
 * Create: POST https://numbers.twilio.com/v1/Porting/PortIn
 * Documents: POST https://numbers-upload.twilio.com/v1/Documents
 *
 * Nothing is submitted until the owner confirms. Live HTTP stays behind
 * PORT_IN_LIVE=true so this build cannot open a real port by accident.
 * Until status is completed, forwarding the old number stays the default path.
 */

export const FORWARDING_DEFAULT_COPY =
  "Until this port completes, keep forwarding your old number. That stays the default path, and the number keeps ringing where it does today.";

export const PORT_IN_BETA_COPY =
  "Twilio's Port In API is in public beta and covers US local numbers. Toll-free numbers are not supported. SixVox will not submit anything until you confirm the letter of authorization.";

const TOLL_FREE_NPA = new Set(["800", "833", "844", "855", "866", "877", "888", "822"]);

export const PORT_STATUSES = [
  "draft",
  "ready",
  "submitted",
  "in_review",
  "waiting_for_signature",
  "in_progress",
  "action_required",
  "completed",
  "canceled",
  "rejected",
] as const;

export type PortStatus = (typeof PORT_STATUSES)[number];

export type PortLoa = {
  customerType: "Individual" | "Business";
  customerName: string;
  accountNumber: string;
  accountTelephoneNumber: string;
  authorizedRepresentative: string;
  authorizedRepresentativeEmail: string;
  street: string;
  street2?: string | null;
  city: string;
  state: string;
  zip: string;
};

export type PortDraft = {
  phoneNumber: string;
  loa: PortLoa;
  hasUtilityBill: boolean;
  notificationEmail?: string | null;
};

export function normalizeUsLocal(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (national.length !== 10) return null;
  const npa = national.slice(0, 3);
  if (TOLL_FREE_NPA.has(npa) || npa === "900") return null;
  if (npa[0] === "0" || npa[0] === "1") return null;
  return `+1${national}`;
}

export function validateLoa(loa: PortLoa): string | null {
  if (loa.customerType !== "Individual" && loa.customerType !== "Business") {
    return "Choose individual or business.";
  }
  if (!loa.customerName.trim()) return "Enter the name on the carrier account.";
  if (!loa.accountNumber.trim())
    return "US local ports need the account number at the losing carrier.";
  if (!normalizeUsLocal(loa.accountTelephoneNumber)) {
    return "Enter the account telephone number as a US local number.";
  }
  if (!loa.authorizedRepresentative.trim()) return "Enter the authorized representative's name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loa.authorizedRepresentativeEmail.trim())) {
    return "Enter the authorized representative's email. They will sign the letter of authorization.";
  }
  if (!loa.street.trim() || !loa.city.trim() || !loa.state.trim() || !loa.zip.trim()) {
    return "Enter the billing address on file with the losing carrier.";
  }
  return null;
}

export function forwardingRemainsDefault(status: PortStatus): boolean {
  return status !== "completed";
}

export function buildPortInBody(input: {
  phoneNumber: string;
  loa: PortLoa;
  documentSid: string;
  notificationEmail?: string | null | undefined;
  accountSid?: string | null | undefined;
}): Record<string, unknown> {
  const phone = normalizeUsLocal(input.phoneNumber);
  const accountPhone = normalizeUsLocal(input.loa.accountTelephoneNumber);
  if (!phone || !accountPhone) throw new Error("Phone number must be a US local number.");
  const loaError = validateLoa(input.loa);
  if (loaError) throw new Error(loaError);
  if (!input.documentSid.trim()) throw new Error("Upload a utility bill before submitting.");

  const body: Record<string, unknown> = {
    documents: [input.documentSid],
    phone_numbers: [{ phone_number: phone }],
    losing_carrier_information: {
      customer_type: input.loa.customerType,
      customer_name: input.loa.customerName.trim(),
      account_number: input.loa.accountNumber.trim(),
      account_telephone_number: accountPhone,
      authorized_representative: input.loa.authorizedRepresentative.trim(),
      authorized_representative_email: input.loa.authorizedRepresentativeEmail.trim(),
      address: {
        street: input.loa.street.trim(),
        street_2: input.loa.street2?.trim() || undefined,
        city: input.loa.city.trim(),
        state: input.loa.state.trim(),
        zip: input.loa.zip.trim(),
        country: "US",
      },
    },
  };
  if (input.accountSid) body["account_sid"] = input.accountSid;
  if (input.notificationEmail?.trim())
    body["notification_emails"] = [input.notificationEmail.trim()];
  return body;
}

export type PortPrepareResult =
  { ok: false; reason: string } | { ok: true; phoneNumber: string; accountLast4: string };

export function preparePortDraft(draft: PortDraft): PortPrepareResult {
  const phoneNumber = normalizeUsLocal(draft.phoneNumber);
  if (!phoneNumber) return { ok: false, reason: "Enter the US local number you want to port." };
  const loaError = validateLoa(draft.loa);
  if (loaError) return { ok: false, reason: loaError };
  if (!draft.hasUtilityBill)
    return { ok: false, reason: "Upload a utility bill from the last 30 days." };
  const digits = draft.loa.accountNumber.replace(/\s/g, "");
  return { ok: true, phoneNumber, accountLast4: digits.slice(-4) };
}

export type PortSubmitDeps = {
  live: boolean;
  uploadDocument: () => Promise<{ sid: string }>;
  createPortIn: (body: Record<string, unknown>) => Promise<{ port_in_request_sid: string }>;
};

export type PortSubmitResult =
  | { submitted: false; status: "ready"; reason: string }
  | { submitted: true; status: "submitted"; sid: string; body: Record<string, unknown> };

/**
 * Owner confirmation is required. With live submission off, the carrier is
 * never called and the request stays ready so forwarding remains the path.
 */
export async function runPortSubmission(
  draft: PortDraft & { confirmed: boolean; accountSid?: string | null },
  deps: PortSubmitDeps,
): Promise<PortSubmitResult> {
  const prepared = preparePortDraft(draft);
  if (!prepared.ok) return { submitted: false, status: "ready", reason: prepared.reason };
  if (!draft.confirmed) {
    return {
      submitted: false,
      status: "ready",
      reason: "Confirm the letter of authorization before SixVox submits this port.",
    };
  }
  if (!deps.live) {
    return {
      submitted: false,
      status: "ready",
      reason:
        "Live port-in submission is turned off (PORT_IN_LIVE is not true). Nothing was sent to Twilio. Forwarding stays in place.",
    };
  }
  const document = await deps.uploadDocument();
  const body = buildPortInBody({
    phoneNumber: prepared.phoneNumber,
    loa: draft.loa,
    documentSid: document.sid,
    notificationEmail: draft.notificationEmail,
    accountSid: draft.accountSid,
  });
  const created = await deps.createPortIn(body);
  return { submitted: true, status: "submitted", sid: created.port_in_request_sid, body };
}

const WEBHOOK_STATUS = {
  waiting_for_signature: "waiting_for_signature",
  in_review: "in_review",
  pending: "in_review",
  in_progress: "in_progress",
  completed: "completed",
  canceled: "canceled",
  cancelled: "canceled",
  rejected: "rejected",
  action_required: "action_required",
} as const satisfies Record<string, PortStatus>;

export type KnownPortWebhook = keyof typeof WEBHOOK_STATUS;

export function parsePortWebhookStatus(raw: string): PortStatus | "unknown" {
  const key = raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (key in WEBHOOK_STATUS) return WEBHOOK_STATUS[key as KnownPortWebhook];
  return "unknown";
}

const TERMINAL: ReadonlySet<PortStatus> = new Set(["completed", "canceled"]);

export function applyPortWebhook(
  current: PortStatus,
  incoming: PortStatus | "unknown",
): PortStatus {
  if (TERMINAL.has(current)) return current;
  if (incoming === "unknown")
    return current === "draft" || current === "ready" ? current : "action_required";
  switch (incoming) {
    case "draft":
    case "ready":
      return current;
    case "submitted":
    case "in_review":
    case "waiting_for_signature":
    case "in_progress":
    case "action_required":
    case "completed":
    case "canceled":
    case "rejected":
      return incoming;
    default: {
      const exhaustive: never = incoming;
      return exhaustive;
    }
  }
}
