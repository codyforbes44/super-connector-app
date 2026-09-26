import { describe, expect, it } from "vitest";

import {
  matchEmergencyKeyword,
  mergeEmergencyPrompt,
  transferToolConfig,
} from "./emergency-keywords";

describe("emergency keywords", () => {
  const keywords = ["gas", "gas leak", "burst pipe", "no heat", "flooding"];

  it("matches the longest phrase and ignores punctuation", () => {
    expect(matchEmergencyKeyword("I think there's a gas leak downstairs", keywords)).toBe(
      "gas leak",
    );
    expect(matchEmergencyKeyword("We have no-heat in the shop", keywords)).toBe("no heat");
    expect(matchEmergencyKeyword("Just calling about a quote", keywords)).toBeNull();
  });

  it("builds a conference transfer tool and keeps the prompt block idempotent", () => {
    const tool = transferToolConfig("+15805550199", ["burst pipe"]);
    expect(tool.params.transfers[0]?.transfer_type).toBe("conference");
    expect(tool.params.transfers[0]?.transfer_destination.phone_number).toBe("+15805550199");

    const once = mergeEmergencyPrompt("Answer the phone.", ["burst pipe"], "+15805550199");
    const twice = mergeEmergencyPrompt(once, ["burst pipe"], "+15805550199");
    expect(twice.match(/\[sixvox-emergency\]/g)).toHaveLength(1);
    expect(twice).toContain("burst pipe");
  });
});
