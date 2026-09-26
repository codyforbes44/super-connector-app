import { describe, expect, it, vi } from "vitest";

import {
  applyPortWebhook,
  forwardingRemainsDefault,
  normalizeUsLocal,
  runPortSubmission,
  type PortDraft,
  type PortLoa,
} from "./port-in";

const LOA: PortLoa = {
  customerType: "Business",
  customerName: "Brooks Plumbing LLC",
  accountNumber: "ACCT-9912",
  accountTelephoneNumber: "5805550100",
  authorizedRepresentative: "Dana Brooks",
  authorizedRepresentativeEmail: "dana@brooks.example",
  street: "18 Oak Street",
  city: "Tulsa",
  state: "OK",
  zip: "74103",
};

const DRAFT: PortDraft = {
  phoneNumber: "(580) 555-0190",
  loa: LOA,
  hasUtilityBill: true,
  notificationEmail: "dana@brooks.example",
};

describe("port-in state", () => {
  it("accepts a US local number and rejects toll-free", () => {
    expect(normalizeUsLocal(DRAFT.phoneNumber)).toBe("+15805550190");
    expect(normalizeUsLocal("+18005550199")).toBeNull();
  });

  it("keeps forwarding as the default until the port completes", () => {
    expect(forwardingRemainsDefault("ready")).toBe(true);
    expect(forwardingRemainsDefault("in_progress")).toBe(true);
    expect(forwardingRemainsDefault("completed")).toBe(false);
  });

  it("does not call Twilio without owner confirmation", async () => {
    const uploadDocument = vi.fn(async () => ({ sid: "RD123" }));
    const createPortIn = vi.fn(async () => ({ port_in_request_sid: "KW123" }));
    const result = await runPortSubmission(
      { ...DRAFT, confirmed: false },
      { live: true, uploadDocument, createPortIn },
    );
    expect(result.submitted).toBe(false);
    expect(uploadDocument).not.toHaveBeenCalled();
    expect(createPortIn).not.toHaveBeenCalled();
  });

  it("does not call Twilio while live submission is off", async () => {
    const uploadDocument = vi.fn(async () => ({ sid: "RD123" }));
    const createPortIn = vi.fn(async () => ({ port_in_request_sid: "KW123" }));
    const result = await runPortSubmission(
      { ...DRAFT, confirmed: true },
      { live: false, uploadDocument, createPortIn },
    );
    expect(result).toMatchObject({ submitted: false, status: "ready" });
    expect(uploadDocument).not.toHaveBeenCalled();
    expect(createPortIn).not.toHaveBeenCalled();
  });

  it("submits once after confirmation when live submission is on", async () => {
    const uploadDocument = vi.fn(async () => ({ sid: "RD123" }));
    const createPortIn = vi.fn(async (body: Record<string, unknown>) => {
      expect(body["documents"]).toEqual(["RD123"]);
      const numbers = body["phone_numbers"] as Array<{ phone_number: string }>;
      expect(numbers[0]?.phone_number).toBe("+15805550190");
      const losing = body["losing_carrier_information"] as { account_number: string };
      expect(losing.account_number).toBe("ACCT-9912");
      return { port_in_request_sid: "KWaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" };
    });
    const result = await runPortSubmission(
      { ...DRAFT, confirmed: true },
      { live: true, uploadDocument, createPortIn },
    );
    expect(result).toMatchObject({
      submitted: true,
      status: "submitted",
      sid: "KWaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
    expect(createPortIn).toHaveBeenCalledOnce();
  });

  it("tracks webhook statuses and does not leave a completed port", () => {
    expect(applyPortWebhook("submitted", "waiting_for_signature")).toBe("waiting_for_signature");
    expect(applyPortWebhook("waiting_for_signature", "in_progress")).toBe("in_progress");
    expect(applyPortWebhook("in_progress", "completed")).toBe("completed");
    expect(applyPortWebhook("in_progress", "rejected")).toBe("rejected");
    expect(applyPortWebhook("completed", "canceled")).toBe("completed");
    expect(applyPortWebhook("submitted", "unknown")).toBe("action_required");
  });
});
