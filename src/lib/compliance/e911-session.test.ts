import { afterEach, describe, expect, it } from "vitest";

import { E911_DISCLOSURE_VERSION } from "./disclosure";
import {
  clearE911NoticeDismissals,
  dismissE911Notice,
  handleE911AuthEvent,
  isE911NoticeDismissed,
} from "./e911-session";

describe("911 notice session dismiss", () => {
  afterEach(() => {
    clearE911NoticeDismissals();
  });

  it("starts open for a user who has not dismissed this disclosure version", () => {
    expect(E911_DISCLOSURE_VERSION).toBe("cfr-47-9.11-2026-09-26");
    expect(isE911NoticeDismissed("user-1")).toBe(false);
  });

  it("stays dismissed for that user and version, and not for someone else", () => {
    dismissE911Notice("user-1");
    expect(isE911NoticeDismissed("user-1")).toBe(true);
    expect(isE911NoticeDismissed("user-2")).toBe(false);
  });

  it("shows again after a fresh load clears the in-memory session", () => {
    dismissE911Notice("user-1");
    clearE911NoticeDismissals();
    expect(isE911NoticeDismissed("user-1")).toBe(false);
  });

  it("shows again after sign-out, and a later sign-in event does not clear it", () => {
    dismissE911Notice("user-1");
    handleE911AuthEvent("SIGNED_IN");
    handleE911AuthEvent("TOKEN_REFRESHED");
    expect(isE911NoticeDismissed("user-1")).toBe(true);
    handleE911AuthEvent("SIGNED_OUT");
    expect(isE911NoticeDismissed("user-1")).toBe(false);
  });
});
