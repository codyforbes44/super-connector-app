import { afterEach, describe, expect, it, vi } from "vitest";

const WORKSPACE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EVIL = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NUMBER = "+15807450045";

const state = vi.hoisted(() => ({
  number: null as Record<string, unknown> | null,
  call: null as Record<string, unknown> | null,
  params: {} as Record<string, string>,
  writes: [] as Array<{ table: string; op: string; row: Record<string, unknown> }>,
  logs: [] as Array<Record<string, unknown>>,
}));

function chain(table: string) {
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  for (const method of ["select", "eq", "in", "order", "limit", "gte", "gt"])
    builder[method] = self;
  const record = (op: string) => (row: Record<string, unknown>) => {
    state.writes.push({ table, op, row });
    return builder;
  };
  builder["insert"] = record("insert");
  builder["upsert"] = record("upsert");
  builder["update"] = record("update");
  builder["maybeSingle"] = () =>
    Promise.resolve({
      data: table === "phone_numbers" ? state.number : table === "calls" ? state.call : null,
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
  supabaseAdmin: {
    from: (table: string) => chain(table),
  },
}));

vi.mock("@/lib/webhook-errors.server", () => ({
  logWebhookError: vi.fn(async (_admin: unknown, input: Record<string, unknown>) => {
    state.logs.push(input);
  }),
}));

vi.mock("@/lib/twilio-signature.server", () => ({
  verifyTwilioWebhook: vi.fn(async () => ({
    ok: true as const,
    via: "signature" as const,
    params: state.params,
  })),
  rejectWebhook: vi.fn(async () => new Response("Unauthorized", { status: 401 })),
}));

vi.mock("@/lib/elevenlabs-signature.server", () => ({
  verifyElevenLabsRequest: vi.fn(async () => ({ ok: true as const, via: "signature" as const })),
}));

vi.mock("@/lib/byo.server", () => ({
  noteForwardedCall: vi.fn(async () => undefined),
}));

vi.mock("@/lib/compliance/recording.server", () => ({
  lineRecordsCalls: vi.fn(async () => false),
}));

vi.mock("@/lib/spam-gate.server", () => ({
  gateInboundCall: vi.fn(async () => ({ ring: true, action: "allow", score: 0, reason: null })),
}));

vi.mock("@/lib/push.server", () => ({
  notifyNumberWatchers: vi.fn(async () => undefined),
  sendPushToUsers: vi.fn(async () => undefined),
}));

vi.mock("@/lib/voice-answer.server", () => ({
  VOICE_CONFIG_COLUMNS: "answer_mode",
  voicemailTwiml: vi.fn(async () => "<Say>vm</Say>"),
  classicVoicemailTwiml: vi.fn(async () => "<Say>vm</Say>"),
  ringbackTwiml: () => "",
  RING_SECONDS: 20,
  RINGBACK_CYCLE_SECONDS: 4,
  forwardedCallTwiml: () => "<Dial/>",
  fallbackVoicemailTwiml: () => "<Say>fallback</Say>",
  outboundAppDialTwiml: () => "<Dial/>",
  inboundClientDialTwiml: () => "<Dial/>",
  inboundRingActionUrl: () => "https://sixvox.3bi.io/api/public/twilio/dial-action?leg=clients",
  liveRecordingPrefix: () => "",
  recordingNoticeWebhook: () => "https://sixvox.3bi.io/notice",
  escapeXml: (value: string) => value,
}));

vi.mock("@/lib/call-automation.server", () => ({
  handleInboundCallUpdate: vi.fn(async () => undefined),
}));

vi.mock("@/lib/outbound-webhooks.server", () => ({
  drainDueDeliveries: vi.fn(async () => undefined),
  publishOutboundEvent: vi.fn(async () => undefined),
}));

vi.mock("@/lib/intelligence.server", () => ({
  ingestCallTranscript: vi.fn(async () => null),
  ensureCallSummary: vi.fn(async () => undefined),
}));

vi.mock("@/lib/notify.server", () => ({
  notifyNumber: vi.fn(async () => undefined),
}));

import { Route as postCallRoute } from "@/routes/api/public/elevenlabs/post-call";
import { Route as statusRoute } from "@/routes/api/public/twilio/status";
import { Route as voiceRoute } from "@/routes/api/public/twilio/voice";

type Handler = (args: { request: Request }) => Promise<Response>;

const voice = (voiceRoute as unknown as { server: { handlers: { POST: Handler } } }).server.handlers
  .POST;
const status = (statusRoute as unknown as { server: { handlers: { POST: Handler } } }).server
  .handlers.POST;
const postCall = (postCallRoute as unknown as { server: { handlers: { POST: Handler } } }).server
  .handlers.POST;

function ownedNumber() {
  state.number = {
    id: "pn-1",
    phone_number: NUMBER,
    workspace_id: WORKSPACE,
    assigned_to: "11111111-1111-4111-8111-111111111111",
    forward_to: null,
    answer_mode: "voicemail",
    elevenlabs_agent_id: null,
    business_hours_enabled: false,
  };
}

afterEach(() => {
  state.number = null;
  state.call = null;
  state.params = {};
  state.writes = [];
  state.logs = [];
});

describe("webhook workspace_id writes", () => {
  it("stamps the voice webhook call from the called number, not the request", async () => {
    ownedNumber();
    state.params = {
      CallSid: "CA-voice",
      From: "+15555550100",
      To: NUMBER,
      CallStatus: "ringing",
      WorkspaceId: EVIL,
    };
    const response = await voice({
      request: new Request("https://sixvox.3bi.io/api/public/twilio/voice", { method: "POST" }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("xml");
    const call = state.writes.find((write) => write.table === "calls" && write.op === "upsert");
    expect(call?.row["workspace_id"]).toBe(WORKSPACE);
    expect(JSON.stringify(call?.row)).not.toContain(EVIL);
    expect(state.logs).toHaveLength(0);
  });

  it("logs a missing voice workspace and still returns TwiML", async () => {
    state.params = {
      CallSid: "CA-missing",
      From: "+15555550100",
      To: "+19995550000",
      CallStatus: "ringing",
    };
    const response = await voice({
      request: new Request("https://sixvox.3bi.io/api/public/twilio/voice", { method: "POST" }),
    });
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain("<Response>");
    expect(
      state.writes.filter((write) => write.table === "calls" && write.op === "upsert"),
    ).toHaveLength(0);
    expect(state.logs.some((log) => log["source"] === "voice")).toBe(true);
  });

  it("stamps the call status callback from the owning number", async () => {
    ownedNumber();
    state.call = {
      spam_action: null,
      app_number: NUMBER,
      direction: "inbound",
      workspace_id: null,
    };
    state.params = {
      CallSid: "CA-status",
      CallStatus: "completed",
      From: "+15555550100",
      To: NUMBER,
      WorkspaceId: EVIL,
    };
    const response = await status({
      request: new Request("https://sixvox.3bi.io/api/public/twilio/status", { method: "POST" }),
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
    const call = state.writes.find((write) => write.table === "calls" && write.op === "update");
    expect(call?.row["workspace_id"]).toBe(WORKSPACE);
    expect(call?.row["status"]).toBe("completed");
    expect(JSON.stringify(call?.row)).not.toContain(EVIL);
  });

  it("logs a status callback that cannot be tied to a workspace and still returns 200", async () => {
    state.params = {
      CallSid: "CA-status-missing",
      CallStatus: "completed",
      From: "+15555550100",
      To: "+19995550000",
    };
    const response = await status({
      request: new Request("https://sixvox.3bi.io/api/public/twilio/status", { method: "POST" }),
    });
    expect(response.status).toBe(200);
    expect(state.logs.some((log) => log["source"] === "status")).toBe(true);
  });

  it("stamps the ElevenLabs post-call row from the called number", async () => {
    ownedNumber();
    const response = await postCall({
      request: new Request("https://sixvox.3bi.io/api/public/elevenlabs/post-call", {
        method: "POST",
        body: JSON.stringify({
          workspace_id: EVIL,
          data: {
            agent_id: "agent-1",
            conversation_id: "conv-1",
            analysis: { transcript_summary: "Caller asked for a quote." },
            transcript: [{ role: "user", message: "I need a plumber." }],
            conversation_initiation_client_data: {
              dynamic_variables: {
                call_sid: "CA-ai",
                called_number: NUMBER,
                workspace_id: EVIL,
              },
            },
          },
        }),
      }),
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
    const transcript = state.writes.find(
      (write) => write.table === "ai_conversations" && write.op === "upsert",
    );
    expect(transcript?.row["workspace_id"]).toBe(WORKSPACE);
    expect(transcript?.row["call_sid"]).toBe("CA-ai");
    expect(JSON.stringify(transcript?.row)).not.toContain(EVIL);
    const call = state.writes.find((write) => write.table === "calls" && write.op === "update");
    expect(call?.row["workspace_id"]).toBe(WORKSPACE);
  });

  it("logs an ElevenLabs post-call with no owning number and still returns 200", async () => {
    const response = await postCall({
      request: new Request("https://sixvox.3bi.io/api/public/elevenlabs/post-call", {
        method: "POST",
        body: JSON.stringify({
          data: {
            conversation_initiation_client_data: {
              dynamic_variables: { call_sid: "CA-ai-missing", workspace_id: EVIL },
            },
          },
        }),
      }),
    });
    expect(response.status).toBe(200);
    expect(state.writes.filter((write) => write.table === "ai_conversations")).toHaveLength(0);
    expect(state.logs.some((log) => log["source"] === "elevenlabs")).toBe(true);
  });
});
