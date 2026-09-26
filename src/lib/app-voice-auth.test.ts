import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { canPlaceOutboundAppCall } from "./app-voice-auth";

const state = vi.hoisted(() => ({
  roles: [] as { role: string }[],
  roleError: null as { message: string } | null,
  number: null as {
    phone_number: string;
    assigned_to: string | null;
    outbound_caller_id: string | null;
  } | null,
  params: {} as Record<string, string>,
  acknowledged: true,
  rpc: vi.fn(() => {
    throw new Error("is_admin must not be called");
  }),
}));

function chain(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  builder["select"] = self;
  builder["eq"] = self;
  builder["in"] = self;
  builder["maybeSingle"] = () => Promise.resolve(result);
  builder["upsert"] = () => Promise.resolve({ data: null, error: null });
  builder["then"] = (
    onFulfilled: (value: unknown) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(onFulfilled, onRejected);
  return builder;
}

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: unknown) => config,
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "phone_numbers") return chain({ data: state.number, error: null });
      if (table === "user_roles") return chain({ data: state.roles, error: state.roleError });
      if (table === "calls") return chain({ data: null, error: null });
      if (table === "e911_acknowledgments") {
        return chain({ data: state.acknowledged ? { id: "ack" } : null, error: null });
      }
      throw new Error(`unexpected table ${table}`);
    },
    rpc: state.rpc,
  },
}));

vi.mock("@/lib/twilio-ops.server", () => ({
  resolveOutboundCallerId: vi.fn(async (_client: unknown, callerId: string) => callerId),
}));

vi.mock("@/lib/twilio-signature.server", () => ({
  verifyTwilioWebhook: vi.fn(async () => ({
    ok: true as const,
    via: "signature" as const,
    params: state.params,
  })),
  rejectWebhook: vi.fn(async () => new Response("Unauthorized", { status: 401 })),
}));

import { Route } from "@/routes/api/public/twilio/app-voice";

const post = (
  Route as unknown as {
    server: {
      handlers: { POST: (args: { request: Request }) => Promise<Response> };
    };
  }
).server.handlers.POST;

const userId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const callerId = "+15550001111";

async function place(
  roles: string[],
  assignedTo: string | null,
  numberOnAccount = true,
  acknowledged = true,
) {
  state.roles = roles.map((role) => ({ role }));
  state.roleError = null;
  state.acknowledged = acknowledged;
  state.number = numberOnAccount
    ? { phone_number: callerId, assigned_to: assignedTo, outbound_caller_id: null }
    : null;
  state.params = {
    From: `client:agent_${userId}`,
    To: "+15550002222",
    CallerId: callerId,
    CallSid: "CA123",
  };
  const response = await post({
    request: new Request("https://sixvox.3bi.io/api/public/twilio/app-voice?t=x", {
      method: "POST",
    }),
  });
  return response.text();
}

afterEach(() => {
  state.rpc.mockClear();
});

describe("canPlaceOutboundAppCall", () => {
  const base = {
    numberOnAccount: true,
    assignedTo: otherId,
    userId,
  };

  it("lets an owner or admin dial any number on the account", () => {
    for (const role of ["owner", "admin", "super_admin"]) {
      expect(canPlaceOutboundAppCall({ ...base, roles: [role] })).toBe(true);
    }
  });

  it("lets an agent dial only an assigned number", () => {
    expect(canPlaceOutboundAppCall({ ...base, assignedTo: userId, roles: ["agent"] })).toBe(true);
    expect(canPlaceOutboundAppCall({ ...base, assignedTo: otherId, roles: ["agent"] })).toBe(false);
    expect(canPlaceOutboundAppCall({ ...base, assignedTo: null, roles: ["agent"] })).toBe(false);
  });

  it("rejects anyone who is neither an account admin nor the assignee", () => {
    expect(canPlaceOutboundAppCall({ ...base, roles: [] })).toBe(false);
    expect(canPlaceOutboundAppCall({ ...base, numberOnAccount: false, roles: ["owner"] })).toBe(
      false,
    );
  });
});

describe("app-voice outbound authorization", () => {
  it("does not consult is_admin", () => {
    const source = readFileSync(
      new URL("../routes/api/public/twilio/app-voice.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(/\.rpc\(/);
  });

  it.each(["owner", "admin"])("lets an %s dial a number assigned to someone else", async (role) => {
    const body = await place([role], otherId);
    expect(body).toContain("<Dial");
    expect(body).toContain(`<Number>+15550002222</Number>`);
    expect(body).not.toContain("not allowed");
    expect(body).not.toMatch(/<Record|\srecord="/);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("lets an agent dial a number assigned to them", async () => {
    const body = await place(["agent"], userId);
    expect(body).toContain("<Dial");
    expect(body).not.toContain("not allowed");
  });

  it("rejects an agent dialing a number that is not assigned to them", async () => {
    const body = await place(["agent"], otherId);
    expect(body).toContain("You are not allowed to call from that number.");
    expect(body).not.toContain("<Dial");
  });

  it("rejects a caller with no role on someone else's number", async () => {
    const body = await place([], otherId);
    expect(body).toContain("You are not allowed to call from that number.");
  });

  it("rejects an owner when the caller ID is not on the account", async () => {
    const body = await place(["owner"], null, false);
    expect(body).toContain("You are not allowed to call from that number.");
  });

  it("blocks an authorized caller until they acknowledge the 911 limitations", async () => {
    const body = await place(["owner"], otherId, true, false);
    expect(body).toContain("acknowledge the 911 service limitations");
    expect(body).not.toContain("<Dial");
  });
});
