import { describe, expect, it } from "vitest";

import {
  ACK_STAGE,
  ACK_WINDOW_SECONDS,
  planPstnFallback,
  pstnFallbackEnabled,
} from "./mobile-ring";

const base = {
  stage: null as string | null,
  ringSeconds: 24,
  acked: false as boolean | null,
  ownerCell: "+15555550100",
  caller: "+15555550199",
};

describe("pstnFallbackEnabled", () => {
  it("is off unless the flag is explicitly on", () => {
    expect(pstnFallbackEnabled({})).toBe(false);
    expect(pstnFallbackEnabled({ MOBILE_PSTN_FALLBACK: "false" })).toBe(false);
    expect(pstnFallbackEnabled({ MOBILE_PSTN_FALLBACK: "0" })).toBe(false);
    expect(pstnFallbackEnabled({ MOBILE_PSTN_FALLBACK: "on" })).toBe(true);
    expect(pstnFallbackEnabled({ MOBILE_PSTN_FALLBACK: "true" })).toBe(true);
  });
});

describe("planPstnFallback", () => {
  it("leaves the existing ring alone when the flag is off", () => {
    expect(planPstnFallback({ ...base, enabled: false })).toEqual({ action: "skip" });
    expect(planPstnFallback({ ...base, enabled: false, stage: ACK_STAGE })).toEqual({
      action: "skip",
    });
  });

  it("rings clients only for the ack window on the first pass", () => {
    expect(planPstnFallback({ ...base, enabled: true })).toEqual({
      action: "clients",
      timeout: ACK_WINDOW_SECONDS,
      nextStage: ACK_STAGE,
    });
  });

  it("adds the owner cell when nobody acknowledged", () => {
    const plan = planPstnFallback({ ...base, enabled: true, stage: ACK_STAGE, acked: false });
    expect(plan).toEqual({
      action: "clients-and-cell",
      timeout: 16,
      nextStage: "retry-done",
      cell: "+15555550100",
    });
  });

  it("keeps ringing clients only after a device acknowledges", () => {
    expect(planPstnFallback({ ...base, enabled: true, stage: ACK_STAGE, acked: true })).toEqual({
      action: "clients",
      timeout: 16,
      nextStage: "retry-done",
    });
  });

  it("does not ring a cell when the ack lookup failed", () => {
    expect(planPstnFallback({ ...base, enabled: true, stage: ACK_STAGE, acked: null })).toEqual({
      action: "clients",
      timeout: 16,
      nextStage: "retry-done",
    });
  });

  it("does not dial the caller back as the owner cell", () => {
    expect(
      planPstnFallback({
        ...base,
        enabled: true,
        stage: ACK_STAGE,
        acked: false,
        ownerCell: "+1 (555) 555-0199",
        caller: "+15555550199",
      }),
    ).toMatchObject({ action: "clients" });
  });
});
