import { describe, expect, it } from "vitest";

import {
  PUSH_CREDENTIAL_ENV,
  pushCredentialEnvName,
  resolvePushCredentialSid,
} from "./mobile-push-credentials";

const IOS_SANDBOX = "CR" + "a".repeat(32);
const IOS_PROD = "CR" + "b".repeat(32);
const ANDROID = "CR" + "c".repeat(32);

const env = {
  [PUSH_CREDENTIAL_ENV.iosSandbox]: IOS_SANDBOX,
  [PUSH_CREDENTIAL_ENV.iosProduction]: IOS_PROD,
  [PUSH_CREDENTIAL_ENV.android]: ANDROID,
};

describe("resolvePushCredentialSid", () => {
  it("picks the sandbox iOS credential", () => {
    expect(resolvePushCredentialSid({ platform: "ios", environment: "sandbox", env })).toBe(
      IOS_SANDBOX,
    );
  });

  it("picks the production iOS credential", () => {
    expect(resolvePushCredentialSid({ platform: "ios", environment: "production", env })).toBe(
      IOS_PROD,
    );
  });

  it("uses the Android credential for either environment", () => {
    expect(resolvePushCredentialSid({ platform: "android", environment: "sandbox", env })).toBe(
      ANDROID,
    );
    expect(pushCredentialEnvName("android", "production")).toBe(PUSH_CREDENTIAL_ENV.android);
  });

  it("ignores a missing or malformed SID", () => {
    expect(
      resolvePushCredentialSid({
        platform: "ios",
        environment: "production",
        env: { [PUSH_CREDENTIAL_ENV.iosProduction]: "not-a-sid" },
      }),
    ).toBeNull();
    expect(
      resolvePushCredentialSid({
        platform: "ios",
        environment: "production",
        workspaceId: "workspace-later",
        env: {},
      }),
    ).toBeNull();
  });
});
