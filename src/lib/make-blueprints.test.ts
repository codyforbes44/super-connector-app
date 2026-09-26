import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("Make.com blueprints", () => {
  const files = readdirSync(new URL("../../docs/make", import.meta.url)).filter((name) =>
    name.endsWith(".json"),
  );

  it("parses every blueprint and includes a signed custom webhook", () => {
    expect(files.length).toBeGreaterThanOrEqual(3);
    for (const file of files) {
      const raw = readFileSync(new URL(`../../docs/make/${file}`, import.meta.url), "utf8");
      const blueprint = JSON.parse(raw) as { flow?: Array<{ module?: string }> };
      const modules = (blueprint.flow ?? []).map((step) => step.module);
      expect(modules).toContain("gateway:CustomWebHook");
      expect(raw).toContain("createHmac");
      expect(raw).toContain("v1=");
      expect(raw).toContain("timestamp");
      expect(raw).toContain("rawBody");
    }
  });
});
