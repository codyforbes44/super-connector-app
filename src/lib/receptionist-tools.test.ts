import { describe, expect, it } from "vitest";

import {
  SHARED_KEY_REASON,
  SPANISH_PROMPT_ADDENDUM,
  elevenLabsDedicated,
  receptionistAgentPatch,
  receptionistTools,
} from "./receptionist-tools";

describe("receptionist tools", () => {
  it("documents the four booking tools and refuses a shared ElevenLabs key", () => {
    const names = receptionistTools().map((tool) => tool.name);
    expect(names).toEqual([
      "check_availability",
      "check_service_area",
      "propose_booking",
      "capture_lead",
    ]);
    expect(
      receptionistTools().every((tool) => tool.api_schema.url.startsWith("https://sixvox.3bi.io/")),
    ).toBe(true);
    const patch = receptionistAgentPatch("auto");
    expect(patch.conversation_config.agent.prompt.prompt).toBe(SPANISH_PROMPT_ADDENDUM);
    expect(patch.conversation_config.agent.prompt.prompt).toMatch(/Spanish/);
    expect(elevenLabsDedicated({})).toBe(false);
    expect(SHARED_KEY_REASON).toMatch(/SIXVOX_ELEVENLABS_DEDICATED/);
  });
});
