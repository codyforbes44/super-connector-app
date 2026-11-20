import { describe, expect, it } from "vitest";
import { checklistSteps } from "./onboarding-checklist";

describe("setup checklist", () => {
  it("starts with nothing done for a brand new account", () => {
    expect(checklistSteps({ numbers: [], notificationsOn: false, installed: false }).every((s) => !s.done)).toBe(true);
  });
  it("counts a connected number with AI answering as two steps done", () => {
    const s = checklistSteps({ numbers: [{ webhook_wired: true, answer_mode: "ai" }], notificationsOn: false, installed: false });
    expect(s.filter((x) => x.done).map((x) => x.id)).toEqual(["number", "answer"]);
  });
  it("does not count answering turned off", () => {
    const s = checklistSteps({ numbers: [{ webhook_wired: true, answer_mode: "off" }], notificationsOn: true, installed: true });
    expect(s.find((x) => x.id === "answer")?.done).toBe(false);
  });
});
