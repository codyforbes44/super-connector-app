import { describe, expect, it } from "vitest";
import {
  importableCall,
  importableMessage,
  uniqueProviderRows,
  validateImportConfirmation,
} from "./provider-identity";

describe("provider identity", () => {
  it("keeps one record per SID", () => {
    expect(
      uniqueProviderRows(
        [
          { sid: "a", body: "first" },
          { sid: "a", body: "retry" },
        ],
        (r) => r.sid,
      ),
    ).toEqual([{ sid: "a", body: "first" }]);
  });
  it("does not merge distinct provider calls that look alike", () => {
    expect(
      uniqueProviderRows(
        [
          { sid: "a", name: "same" },
          { sid: "b", name: "same" },
        ],
        (r) => r.sid,
      ),
    ).toHaveLength(2);
  });
  it("never imports empty texts", () => {
    expect(importableMessage({ sid: "a", from: "a", to: "b", body: " ", num_media: "0" })).toBe(
      false,
    );
  });
  it("keeps attachment-only texts", () => {
    expect(importableMessage({ sid: "a", from: "a", to: "b", body: "", num_media: "1" })).toBe(
      true,
    );
  });
  it("does not import internal child call legs", () => {
    expect(importableCall({ sid: "a", from: "a", to: "b", parent_call_sid: "parent" })).toBe(false);
  });
  it("rejects an unconfirmed import", () => {
    expect(() => validateImportConfirmation({})).toThrow("Preview and confirm");
  });
});
