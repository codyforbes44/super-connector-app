import { afterEach, describe, expect, it, vi } from "vitest";

import { syncAnsweringLanguage, syncEmergencyTransfer } from "./elevenlabs.server";

vi.mock("@/integrations/supabase/client.server", () => {
  throw new Error("Database unavailable in this isolated regression test");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("ElevenLabs partial agent updates", () => {
  const agentId = "agent_9701m5tte67we5mtnccf6ggn302h";

  function provider() {
    vi.stubEnv("ELEVENLABS_API_KEY", "test-only-key");
    vi.stubEnv("ELEVENLABS_ALLOWED_AGENT_IDS", agentId);
    const existing = {
      prompt: "Keep this business instruction.",
      tools: [{ name: "existing_booking_tool" }],
      tool_ids: ["existing_tool_id"],
      built_in_tools: { end_call: { type: "system", name: "end_call" } },
    };
    const patches: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init?: RequestInit) => {
      if (init?.method !== "PATCH") {
        return Response.json({ conversation_config: { agent: { prompt: existing } } });
      }
      const body = JSON.parse(String(init.body));
      const prompt = body.conversation_config.agent.prompt;
      patches.push(prompt);
      if ("tools" in prompt && "tool_ids" in prompt) {
        return Response.json({ detail: "both_tools_and_tool_ids_provided" }, { status: 400 });
      }
      return Response.json({ agent_id: agentId });
    }));
    return { existing, patches };
  }

  it("syncs answering language without resending conflicting tool representations", async () => {
    const { patches, existing } = provider();
    const result = await syncAnsweringLanguage({ agentId, language: "es" });
    expect(result.synced).toBe(true);
    expect(patches).toHaveLength(1);
    const patch = patches[0];
    if (!patch) throw new Error("Expected a language PATCH request");
    expect(Object.keys(patch)).toEqual(["prompt"]);
    expect(patch["prompt"]).toContain(existing.prompt);
    expect(patch["prompt"]).toContain("Spanish");
  });

  it("syncs emergency transfer without changing custom tools and preserves other built-in tools", async () => {
    const { patches, existing } = provider();
    const result = await syncEmergencyTransfer({ agentId, keywords: ["urgent"], phone: "+15802178444" });
    expect(result.synced).toBe(true);
    expect(patches).toHaveLength(1);
    const patch = patches[0];
    if (!patch) throw new Error("Expected an emergency PATCH request");
    expect(Object.keys(patch).sort()).toEqual(["built_in_tools", "prompt"]);
    expect(patch["prompt"]).toContain(existing.prompt);
    expect(patch["built_in_tools"]).toMatchObject({
      end_call: existing.built_in_tools.end_call,
      transfer_to_number: expect.any(Object),
    });
  });
});