/**
 * Twilio Voice push credential SIDs for the native app.
 *
 * Today there is one Twilio account, so the SIDs live in environment variables.
 * When each workspace has its own subaccount, replace the env read with a
 * lookup keyed by `workspaceId` (credentials are created inside that subaccount).
 * Callers already pass `workspaceId` so that swap does not change the mobile API.
 */

export type MobileVoicePlatform = "ios" | "android";
export type MobilePushEnvironment = "sandbox" | "production";

export const PUSH_CREDENTIAL_ENV = {
  iosSandbox: "TWILIO_PUSH_CREDENTIAL_SID_IOS_SANDBOX",
  iosProduction: "TWILIO_PUSH_CREDENTIAL_SID_IOS_PRODUCTION",
  android: "TWILIO_PUSH_CREDENTIAL_SID_ANDROID",
} as const;

const CREDENTIAL_SID = /^CR[0-9a-f]{32}$/i;

export function pushCredentialEnvName(
  platform: MobileVoicePlatform,
  environment: MobilePushEnvironment,
): string {
  if (platform === "android") return PUSH_CREDENTIAL_ENV.android;
  return environment === "sandbox"
    ? PUSH_CREDENTIAL_ENV.iosSandbox
    : PUSH_CREDENTIAL_ENV.iosProduction;
}

export function resolvePushCredentialSid(input: {
  platform: MobileVoicePlatform;
  environment: MobilePushEnvironment;
  /** Present so a per-workspace subaccount lookup can replace the env read. */
  workspaceId?: string | null;
  env?: Record<string, string | undefined>;
}): string | null {
  void input.workspaceId;
  const env = input.env ?? process.env;
  const name = pushCredentialEnvName(input.platform, input.environment);
  const value = env[name]?.trim();
  if (!value || !CREDENTIAL_SID.test(value)) return null;
  return value;
}
