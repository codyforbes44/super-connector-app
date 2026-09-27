import { afterEach, describe, expect, it, vi } from "vitest";

const NUMBER = "+15807450045";
const CELL = "+15555550199";
const WORKSPACE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const state = vi.hoisted(() => ({
  authOk: true,
  spamRing: true,
  params: {} as Record<string, string>,
  number: null as Record<string, unknown> | null,
  ring: {
    identities: [] as string[],
    userIds: [] as string[],
    fallback: "voicemail" as "owner_cell" | "ai" | "voicemail",
    ownerCell: null as string | null,
    workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as string | null,
  },
  updates: [] as Array<{ table: string; row: Record<string, unknown> }>,
}));

function chain(table: string) {
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  for (const method of ["select", "eq", "in", "gt", "gte", "order", "limit"]) {
    builder[method] = self;
  }
  builder["insert"] = self;
  builder["upsert"] = (row: Record<string, unknown>) => {
    state.updates.push({ table, row });
    return builder;
  };
  builder["update"] = (row: Record<string, unknown>) => {
    state.updates.push({ table, row });
    return builder;
  };
  builder["maybeSingle"] = () =>
    Promise.resolve({
      data: table === "phone_numbers" ? state.number : null,
      error: null,
    });
  builder["then"] = (
    onFulfilled: (value: unknown) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
  return builder;
}

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: unknown) => config,
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: (table: string) => chain(table) },
}));

vi.mock("@/lib/twilio-signature.server", () => ({
  verifyTwilioWebhook: vi.fn(async () =>
    state.authOk
      ? { ok: true as const, via: "signature" as const, params: state.params }
      : { ok: false as const, reason: "signature mismatch", params: state.params },
  ),
  rejectWebhook: vi.fn(async () => new Response("Unauthorized", { status: 401 })),
}));

vi.mock("@/lib/webhook-errors.server", () => ({
  logWebhookError: vi.fn(async () => undefined),
}));

vi.mock("@/lib/byo.server", () => ({
  noteForwardedCall: vi.fn(async () => undefined),
}));

vi.mock("@/lib/compliance/recording.server", () => ({
  lineRecordsCalls: vi.fn(async () => false),
}));

vi.mock("@/lib/spam-gate.server", () => ({
  gateInboundCall: vi.fn(async () => ({
    ring: state.spamRing,
    action: state.spamRing ? "allow" : "block",
    score: 0,
    reason: null,
  })),
}));

vi.mock("@/lib/push.server", () => ({
  notifyNumberWatchers: vi.fn(async () => undefined),
  sendPushToUsers: vi.fn(async () => undefined),
}));

vi.mock("@/lib/ring-targets.server", () => ({
  loadInboundRing: vi.fn(async () => state.ring),
}));

vi.mock("@/lib/call-automation.server", () => ({
  handleInboundCallUpdate: vi.fn(async () => undefined),
}));

vi.mock("@/lib/voice-answer.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/voice-answer.server")>();
  return {
    ...actual,
    voicemailTwiml: vi.fn(async () => "<Say>ai-or-vm</Say>"),
    classicVoicemailTwiml: vi.fn(async () => "<Say>after-hours-vm</Say>"),
  };
});

import { handleInboundCallUpdate } from "@/lib/call-automation.server";
import { notifyNumberWatchers } from "@/lib/push.server";
import { loadInboundRing } from "@/lib/ring-targets.server";
import { Route as dialRoute } from "@/routes/api/public/twilio/dial-action";
import { Route as voiceRoute } from "@/routes/api/public/twilio/voice";

type Handler = (args: { request: Request }) => Promise<Response>;

const voice = (voiceRoute as unknown as { server: { handlers: { POST: Handler } } }).server.handlers
  .POST;
const dial = (dialRoute as unknown as { server: { handlers: { POST: Handler } } }).server.handlers
  .POST;

function closedHours() {
  return {
    sun: [],
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
  };
}

function ownedNumber(overrides: Record<string, unknown> = {}) {
  state.number = {
    id: "pn-1",
    phone_number: NUMBER,
    workspace_id: WORKSPACE,
    assigned_to: "11111111-1111-4111-8111-111111111111",
    forward_to: null,
    answer_mode: "voicemail",
    elevenlabs_agent_id: null,
    business_hours_enabled: false,
    business_timezone: "America/Chicago",
    business_hours: null,
    business_holidays: [],
    after_hours_route: "ai",
    ...overrides,
  };
}

function voiceParams() {
  state.params = {
    CallSid: "CA-voice",
    From: "+15555550100",
    To: NUMBER,
    CallStatus: "ringing",
  };
}

afterEach(() => {
  state.authOk = true;
  state.spamRing = true;
  state.params = {};
  state.number = null;
  state.ring = {
    identities: [],
    userIds: [],
    fallback: "voicemail",
    ownerCell: null,
    workspaceId: WORKSPACE,
  };
  state.updates = [];
  vi.clearAllMocks();
});

async function postVoice() {
  return voice({
    request: new Request("https://sixvox.3bi.io/api/public/twilio/voice", { method: "POST" }),
  });
}

async function postDial(leg: string | null, dialStatus: string) {
  const query = leg ? `?leg=${encodeURIComponent(leg)}` : "";
  state.params = {
    ...state.params,
    CallSid: "CA-dial",
    From: "+15555550100",
    To: NUMBER,
    CallStatus: "in-progress",
    DialCallStatus: dialStatus,
  };
  return dial({
    request: new Request(`https://sixvox.3bi.io/api/public/twilio/dial-action${query}`, {
      method: "POST",
    }),
  });
}

describe("voice webhook inbound ring", () => {
  it("dials present clients during business hours", async () => {
    ownedNumber();
    voiceParams();
    state.ring = {
      identities: ["client:a", "client:b"],
      userIds: ["user-a", "user-b"],
      fallback: "owner_cell",
      ownerCell: CELL,
      workspaceId: WORKSPACE,
    };
    const response = await postVoice();
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain("<Client>client:a</Client>");
    expect(body).toContain("<Client>client:b</Client>");
    expect(body).toContain("leg=clients");
    expect(body).not.toContain("<Number>");
    expect(loadInboundRing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ appNumber: NUMBER, aiEnabled: false, forwardTo: null }),
    );
    expect(notifyNumberWatchers).toHaveBeenCalled();
    expect(state.updates.some((update) => update.row["answer_path"] === "in_app")).toBe(true);
  });

  it("dials the owner cell when nobody is in the app", async () => {
    ownedNumber({ forward_to: CELL });
    voiceParams();
    state.ring = {
      identities: [],
      userIds: [],
      fallback: "owner_cell",
      ownerCell: CELL,
      workspaceId: WORKSPACE,
    };
    const body = await (await postVoice()).text();
    expect(body).toContain(`<Number>${CELL}</Number>`);
    expect(body).toContain("leg=owner_cell");
    expect(body).not.toContain("<Client>");
    expect(state.updates.some((update) => update.row["answer_path"] === "owner_cell")).toBe(true);
  });

  it("keeps the AI and voicemail path when there is no client and no cell", async () => {
    ownedNumber({ answer_mode: "ai_agent", elevenlabs_agent_id: "agent-1" });
    voiceParams();
    state.ring = {
      identities: [],
      userIds: [],
      fallback: "ai",
      ownerCell: null,
      workspaceId: WORKSPACE,
    };
    const body = await (await postVoice()).text();
    expect(body).toContain("<Say>ai-or-vm</Say>");
    expect(body).toContain("<Play");
    expect(body).not.toContain("<Dial");
    expect(loadInboundRing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ aiEnabled: true }),
    );
  });

  it("rejects spam before planning a ring", async () => {
    ownedNumber();
    voiceParams();
    state.spamRing = false;
    state.ring = {
      identities: ["client:a"],
      userIds: ["user-a"],
      fallback: "owner_cell",
      ownerCell: CELL,
      workspaceId: WORKSPACE,
    };
    const body = await (await postVoice()).text();
    expect(body).toContain("<Reject");
    expect(loadInboundRing).not.toHaveBeenCalled();
    expect(notifyNumberWatchers).not.toHaveBeenCalled();
  });

  it("keeps after-hours voicemail and does not ring clients", async () => {
    ownedNumber({
      business_hours_enabled: true,
      business_hours: closedHours(),
      after_hours_route: "voicemail",
    });
    voiceParams();
    state.ring = {
      identities: ["client:a"],
      userIds: ["user-a"],
      fallback: "owner_cell",
      ownerCell: CELL,
      workspaceId: WORKSPACE,
    };
    const body = await (await postVoice()).text();
    expect(body).toContain("<Say>after-hours-vm</Say>");
    expect(body).not.toContain("<Client>");
    expect(loadInboundRing).not.toHaveBeenCalled();
  });

  it("still requires a valid Twilio signature", async () => {
    ownedNumber();
    voiceParams();
    state.authOk = false;
    const response = await postVoice();
    expect(response.status).toBe(401);
    expect(loadInboundRing).not.toHaveBeenCalled();
  });
});

describe("dial-action ring continuation", () => {
  it.each(["no-answer", "busy", "failed", "canceled"] as const)(
    "follows an unanswered client %s with the owner cell",
    async (dialStatus) => {
      ownedNumber({ forward_to: CELL });
      state.ring = {
        identities: [],
        userIds: [],
        fallback: "owner_cell",
        ownerCell: CELL,
        workspaceId: WORKSPACE,
      };
      const body = await (await postDial("clients", dialStatus)).text();
      expect(body).toContain(`<Number>${CELL}</Number>`);
      expect(body).toContain("leg=owner_cell");
      expect(handleInboundCallUpdate).not.toHaveBeenCalled();
    },
  );

  it("follows an unanswered owner-cell leg with AI or voicemail", async () => {
    ownedNumber();
    const body = await (await postDial("owner_cell", "no-answer")).text();
    expect(body).toContain("<Say>ai-or-vm</Say>");
    expect(body).not.toContain("<Dial");
    expect(handleInboundCallUpdate).not.toHaveBeenCalled();
    expect(loadInboundRing).not.toHaveBeenCalled();
  });

  it.each(["completed", "answered"] as const)(
    "ends the call when the dial was %s and still runs text-back bookkeeping",
    async (dialStatus) => {
      ownedNumber();
      const response = await postDial("clients", dialStatus);
      const body = await response.text();
      expect(response.status).toBe(200);
      expect(body).not.toContain("<Dial");
      expect(body).not.toContain("<Say");
      expect(body).toContain("<Response>");
      expect(handleInboundCallUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ DialCallStatus: dialStatus }),
        "dial",
      );
      expect(state.updates.some((update) => update.row["answered_in_app"] === true)).toBe(true);
    },
  );

  it("keeps a dial outside the ring chain on the existing hangup and text-back path", async () => {
    ownedNumber();
    const body = await (await postDial(null, "no-answer")).text();
    expect(body).not.toContain("<Dial");
    expect(body).not.toContain("<Say");
    expect(handleInboundCallUpdate).toHaveBeenCalled();
    expect(loadInboundRing).not.toHaveBeenCalled();
  });
});
