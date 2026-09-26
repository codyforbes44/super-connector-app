import { describe, expect, it } from "vitest";

import { scoreSpam } from "./score";

describe("scoreSpam", () => {
  it("never rings a block-listed caller, even with full attestation", () => {
    const decision = scoreSpam({
      stirVerstat: "A",
      lineType: "mobile",
      allowListed: false,
      blockListed: true,
    });
    expect(decision.action).toBe("block");
    expect(decision.ring).toBe(false);
  });

  it("lets an allow-listed caller through a failed StirVerstat", () => {
    const decision = scoreSpam({
      stirVerstat: "TN-Validation-Failed-C",
      lineType: "nonFixedVoip",
      allowListed: true,
      blockListed: false,
    });
    expect(decision.ring).toBe(true);
    expect(decision.score).toBe(0);
  });

  it("blocks known spam from StirVerstat and Lookup line type without ringing", () => {
    const decision = scoreSpam({
      stirVerstat: "Failed",
      lineType: "nonFixedVoip",
      allowListed: false,
      blockListed: false,
    });
    expect(decision.score).toBeGreaterThanOrEqual(70);
    expect(decision.action).toBe("block");
    expect(decision.ring).toBe(false);
    expect(decision.reason).toMatch(/spam/i);
  });

  it("rings a mobile caller with A-level attestation", () => {
    const decision = scoreSpam({
      stirVerstat: "A",
      lineType: "mobile",
      allowListed: false,
      blockListed: false,
    });
    expect(decision.ring).toBe(true);
    expect(decision.action).toBe("allow");
  });
});
