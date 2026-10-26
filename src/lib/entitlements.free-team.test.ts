import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  configured: null as Record<string, unknown> | null,
  readError: null as { message: string } | null,
  writeError: null as { message: string } | null,
  rows: [] as Record<string, unknown>[],
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from(table: string) {
      if (table === "plan_limits") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.configured, error: state.readError }) }) }) };
      }
      if (table !== "workspace_entitlements") throw new Error(`Unexpected table ${table}`);
      return {
        upsert: async (row: Record<string, unknown>) => {
          state.rows.push(row);
          const required = ["max_numbers", "max_seats", "included_ai_calls", "sms_per_hour"];
          const missing = required.find((key) => row[key] == null);
          return { error: state.writeError ?? (missing ? { message: `${missing} must not be null` } : null) };
        },
      };
    },
  },
}));

import { grantFreeTeamEntitlements } from "./entitlements.server";

beforeEach(() => {
  state.configured = null;
  state.readError = null;
  state.writeError = null;
  state.rows = [];
});

describe("complimentary new-team plan", () => {
  it("attaches an active Team plan with every required limit when configuration is missing", async () => {
    await grantFreeTeamEntitlements("new-team");
    expect(state.rows).toEqual([{
      workspace_id: "new-team", plan_code: "team", status: "active",
      max_numbers: 3, max_seats: 5, included_ai_calls: 200,
      ai_minute_cap: null, allow_international: true, sms_per_hour: 400,
    }]);
  });

  it("uses the configured Team limits rather than overwriting them with defaults", async () => {
    state.configured = {
      max_numbers: 4, max_seats: 6, included_ai_calls: 250,
      ai_minute_cap: 500, allow_international: false, sms_per_hour: 450,
    };
    await grantFreeTeamEntitlements("configured-team");
    expect(state.rows[0]).toMatchObject({ ...state.configured, workspace_id: "configured-team", plan_code: "team", status: "active" });
  });

  it("rejects a failed plan attachment instead of reporting success", async () => {
    state.writeError = { message: "write failed" };
    await expect(grantFreeTeamEntitlements("new-team")).rejects.toThrow("Couldn't attach the free Team plan: write failed");
  });

  it("stops before writing when loading plan configuration fails", async () => {
    state.readError = { message: "read failed" };
    await expect(grantFreeTeamEntitlements("new-team")).rejects.toThrow("Couldn't load the Team plan: read failed");
    expect(state.rows).toEqual([]);
  });
});