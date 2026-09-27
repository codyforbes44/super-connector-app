import { afterEach, describe, expect, it, vi } from "vitest";

const WORKSPACE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NUMBER = "+15807450045";
const TOKEN = "shared-webhook-token";

const state = vi.hoisted(() => ({
  inserts: [] as Array<Record<string, unknown>>,
  workspaceByNumber: new Map<string, string>(),
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        state.inserts.push({ table, ...row });
        return Promise.resolve({ error: null });
      },
    }),
  },
}));

vi.mock("./workspace.server", () => ({
  resolveWorkspaceIdForNumber: async (phoneNumber: string) => ({
    workspaceId: state.workspaceByNumber.get(phoneNumber) ?? null,
    phoneNumberId: null,
    assignedTo: null,
  }),
}));

import { rejectWebhook } from "./twilio-signature.server";

function unsignedRequest() {
  return new Request(`https://sixvox.3bi.io/api/public/twilio/voice?t=${TOKEN}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "CallSid=CA-unsigned",
  });
}

afterEach(() => {
  state.inserts = [];
  state.workspaceByNumber.clear();
  vi.restoreAllMocks();
});

describe("webhook error logging without a workspace", () => {
  it("records an unsigned request without a To as a system error and still returns 401", async () => {
    const response = await rejectWebhook(unsignedRequest(), "missing signature", {
      CallSid: "CA-unsigned",
    });

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Unauthorized");
    expect(state.inserts).toEqual([
      expect.objectContaining({
        table: "webhook_errors",
        source: "voice",
        workspace_id: null,
        app_number: null,
        call_sid: "CA-unsigned",
      }),
    ]);
    expect(JSON.stringify(state.inserts)).not.toContain(TOKEN);
  });

  it("inserts a known number with its workspace_id and still returns 401", async () => {
    state.workspaceByNumber.set(NUMBER, WORKSPACE);
    const response = await rejectWebhook(unsignedRequest(), "signature mismatch", {
      To: NUMBER,
      CallSid: "CA-known",
    });

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Unauthorized");
    expect(state.inserts).toEqual([
      expect.objectContaining({
        table: "webhook_errors",
        source: "voice",
        workspace_id: WORKSPACE,
        app_number: NUMBER,
        call_sid: "CA-known",
      }),
    ]);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(TOKEN);
    expect(JSON.stringify(state.inserts)).not.toContain(TOKEN);
  });

  it("records an unmapped number without assigning it to another workspace", async () => {
    const response = await rejectWebhook(unsignedRequest(), "signature mismatch", {
      To: "+15555550100",
      CallSid: "CA-unmapped",
    });

    expect(response.status).toBe(401);
    expect(state.inserts).toEqual([
      expect.objectContaining({
        table: "webhook_errors",
        workspace_id: null,
        app_number: "+15555550100",
        call_sid: "CA-unmapped",
      }),
    ]);
  });
});
