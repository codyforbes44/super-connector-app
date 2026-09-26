import { describe, expect, it } from "vitest";

import {
  TRUST_POLICIES,
  assertTrustHubReady,
  buildTrustHubCalls,
  cnamEligible,
  inferBusinessIdType,
  type TrustHubDraft,
} from "./trusthub";

const BUSINESS = {
  legalName: "Acme Plumbing LLC",
  registrationNumber: "12-3456789",
  contactEmail: "owner@example.com",
};

function draft(overrides: Partial<TrustHubDraft> = {}): TrustHubDraft {
  return {
    business: BUSINESS,
    customerProfileSid: "BUaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    businessIdType: "EIN",
    cnamDisplayName: "ACME PLUMBING",
    voiceIntegrityUseCase: "Customer Support",
    employeeCount: 8,
    dailyCallVolume: 40,
    includeShakenStir: true,
    includeCnam: true,
    includeVoiceIntegrity: true,
    ...overrides,
  };
}

describe("Trust Hub drafts", () => {
  it("reuses the A2P customer profile and the published policy SIDs", () => {
    const calls = buildTrustHubCalls(draft());
    expect(calls.some((call) => call.kind === "customer_profile")).toBe(false);
    const products = calls.filter((call) => call.kind === "trust_product");
    expect(products.map((call) => call.params["PolicySid"])).toEqual([
      TRUST_POLICIES.shakenStir,
      TRUST_POLICIES.cnam,
      TRUST_POLICIES.voiceIntegrity,
    ]);
    const cnam = calls.find((call) => call.kind === "end_user" && call.product === "cnam");
    expect(cnam?.params["Type"]).toBe("cnam_information");
    expect(cnam?.params["Attributes.cnam_display_name"]).toBe("ACME PLUMBING");
  });

  it("describes a secondary customer profile when A2P has not created one", () => {
    const calls = buildTrustHubCalls(
      draft({ customerProfileSid: null, includeCnam: false, includeVoiceIntegrity: false }),
    );
    expect(calls[0]).toMatchObject({
      kind: "customer_profile",
      path: "/v1/CustomerProfiles",
      params: { PolicySid: TRUST_POLICIES.secondaryCustomerProfile },
    });
  });

  it("refuses CNAM without an EIN or DUNS", () => {
    expect(inferBusinessIdType("12-3456789")).toBe("EIN");
    expect(inferBusinessIdType("123456789")).toBe("DUNS");
    expect(cnamEligible("none")).toBe(false);
    expect(() => buildTrustHubCalls(draft({ businessIdType: "none" }))).toThrow(/EIN or a DUNS/);
  });

  it("saves a confirmed draft and does not submit unless the live flag is set", () => {
    expect(() => assertTrustHubReady({ ownerConfirmed: false })).toThrow(/owner/);
    expect(assertTrustHubReady({ ownerConfirmed: true, env: {} })).toBe("saved");
    expect(
      assertTrustHubReady({
        ownerConfirmed: true,
        env: { SIXVOX_ALLOW_TRUSTHUB_SUBMIT: "confirm-live-submit" },
      }),
    ).toBe("submit");
  });
});
