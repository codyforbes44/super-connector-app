import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  A2P_TRUST_PRODUCT_POLICY,
  lowVolumeBrandRegistration,
  solePropBrandRegistration,
} from "./a2p-api";
import { assertFeeAcknowledged, solePropIneligible } from "./a2p-fees";
import { outboundSmsDecision } from "./a2p-guard";
import { prefillAiGreeting } from "./ai-greeting";
import { assertNumberCapacity, DEFAULT_PLAN_LIMITS, PlanLimitError } from "./plan-limits";
import { planInboundRing } from "./ring-targets";
import { TENANT_TABLES } from "./tenant-tables";
import { selectTwilioAccount } from "./twilio-account";
import { twilioRequest } from "./twilio.server";

const parent = {
  accountSid: "ACparent",
  authToken: "parent-token",
  apiKeySid: "SKparent",
  apiKeySecret: "parent-secret",
};

describe("plan limits", () => {
  it("blocks a Solo workspace from a second number", () => {
    expect(() =>
      assertNumberCapacity({ limits: DEFAULT_PLAN_LIMITS.solo, numbersInUse: 1 }),
    ).toThrow(PlanLimitError);
    expect(() =>
      assertNumberCapacity({ limits: DEFAULT_PLAN_LIMITS.solo, numbersInUse: 0 }),
    ).not.toThrow();
  });

  it("keeps the published caps", () => {
    expect(DEFAULT_PLAN_LIMITS.solo).toMatchObject({
      maxNumbers: 1,
      maxSeats: 1,
      includedAiCalls: 50,
    });
    expect(DEFAULT_PLAN_LIMITS.team).toMatchObject({
      maxNumbers: 3,
      maxSeats: 5,
      includedAiCalls: 200,
    });
    expect(DEFAULT_PLAN_LIMITS.scale).toMatchObject({
      maxNumbers: 10,
      maxSeats: 20,
      includedAiCalls: 600,
    });
    expect(DEFAULT_PLAN_LIMITS.trial).toMatchObject({
      maxNumbers: 1,
      maxSeats: 1,
      includedAiCalls: 20,
    });
  });
});

describe("inbound ringing", () => {
  it("rings only present assignees of the called workspace", () => {
    const plan = planInboundRing({
      workspaceId: "workspace-a",
      assignedUserIds: ["user-a", "user-b"],
      ownerCell: "+15555550100",
      aiEnabled: true,
      now: Date.parse("2026-09-26T12:00:00Z"),
      presence: [
        {
          userId: "user-a",
          workspaceId: "workspace-a",
          identity: "client:a",
          lastSeenAt: "2026-09-26T11:59:40Z",
        },
        {
          userId: "user-b",
          workspaceId: "workspace-b",
          identity: "client:b",
          lastSeenAt: "2026-09-26T11:59:40Z",
        },
      ],
    });
    expect(plan.identities).toEqual(["client:a"]);
    expect(plan.userIds).toEqual(["user-a"]);
  });
});

describe("twilio account factory", () => {
  it("uses the workspace subaccount when it is provisioned", () => {
    const selected = selectTwilioAccount({
      usesParentAccount: false,
      subaccountSid: "ACsub",
      subaccountAuthToken: "sub-token",
      apiKeySid: "SKsub",
      apiKeySecret: "sub-secret",
      twimlAppSid: "APsub",
      messagingServiceSid: "MGsub",
      parent,
    });
    expect(selected).toMatchObject({
      accountSid: "ACsub",
      authToken: "sub-token",
      source: "subaccount",
    });
  });

  it("keeps the founding workspace on the parent account", () => {
    const selected = selectTwilioAccount({
      usesParentAccount: true,
      subaccountSid: "ACsub",
      subaccountAuthToken: "sub-token",
      apiKeySid: null,
      apiKeySecret: null,
      twimlAppSid: null,
      messagingServiceSid: null,
      parent,
    });
    expect(selected.source).toBe("parent");
    expect(selected.accountSid).toBe("ACparent");
  });

  it("sends API calls to the selected subaccount", async () => {
    const urls: string[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request) => {
      urls.push(String(url));
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    try {
      await twilioRequest({
        path: "/IncomingPhoneNumbers.json",
        account: { accountSid: "ACsub", authToken: "sub-token" },
      });
    } finally {
      globalThis.fetch = original;
    }
    expect(urls[0]).toContain(
      "https://api.twilio.com/2010-04-01/Accounts/ACsub/IncomingPhoneNumbers.json",
    );
  });
});

describe("A2P outbound gate", () => {
  it("blocks business texts until the campaign is approved", () => {
    expect(
      outboundSmsDecision({ channel: "sms", grandfathered: false, campaignStatus: "PENDING" })
        .allowed,
    ).toBe(false);
    expect(
      outboundSmsDecision({ channel: "sms", grandfathered: false, campaignStatus: "APPROVED" })
        .allowed,
    ).toBe(true);
    expect(
      outboundSmsDecision({ channel: "sms", grandfathered: true, campaignStatus: null }).allowed,
    ).toBe(true);
  });

  it("rejects an LLC on the sole proprietor path and requires a fee confirmation", () => {
    expect(
      solePropIneligible({ businessType: "Limited Liability Corporation", registrationNumber: "" }),
    ).toBeTruthy();
    expect(() => assertFeeAcknowledged(false, "low_volume_standard")).toThrow(/fees/i);
  });

  it("matches the published brand registration bodies", () => {
    const low = lowVolumeBrandRegistration({
      customerProfileBundleSid: "BU1",
      a2pProfileBundleSid: "BU2",
      mock: false,
    });
    expect(low["SkipAutomaticSecVet"]).toBe(true);
    expect(low["BrandType"]).toBeUndefined();
    expect(
      solePropBrandRegistration({
        customerProfileBundleSid: "BU1",
        a2pProfileBundleSid: "BU2",
        mock: false,
      })["BrandType"],
    ).toBe("SOLE_PROPRIETOR");
    expect(A2P_TRUST_PRODUCT_POLICY).toBe("RNb0d4771c2c98518d916a3d4cd70a8f8b");
  });
});

describe("onboarding greeting", () => {
  it("prefills the assistant from the business details", () => {
    const greeting = prefillAiGreeting({
      businessName: "Acme Plumbing",
      hours: "Mon–Fri 8–5",
      website: "https://acme.example",
    });
    expect(greeting).toContain("Acme Plumbing");
    expect(greeting).toContain("Mon–Fri 8–5");
    expect(greeting).toContain("https://acme.example");
  });
});

describe("tenant isolation contract", () => {
  const migration = readFileSync(
    "supabase/migrations/20260926120000_phase1_workspaces.sql",
    "utf8",
  );
  const probe = readFileSync("scripts/tenant-isolation.sql", "utf8");

  it("puts every tenant table behind membership RLS", () => {
    for (const table of TENANT_TABLES) {
      expect(migration).toContain(`'${table}'`);
      expect(probe).toContain(`'${table}'`);
    }
    expect(migration).toContain("is_workspace_member");
    expect(probe).toContain("other_count <> 0");
  });
});
