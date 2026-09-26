import { describe, expect, it } from "vitest";

import { WEB_LINKS, webUrl } from "./web-links";

describe("web links", () => {
  it("keeps admin screens on the public site", () => {
    expect(webUrl("https://sixvox.3bi.io/", "/numbers")).toBe("https://sixvox.3bi.io/numbers");
    expect(WEB_LINKS.map((link) => link.path)).toContain("/receptionist");
    expect(WEB_LINKS.map((link) => link.path)).toContain("/billing");
  });
});
