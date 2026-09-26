import { voiceIdentityFor } from "./voice-token.server";

export type MobilePresencePlatform = "ios" | "android";

/**
 * Row key in `voice_presence` for one native install.
 * This is not the Twilio client identity. Every device for a user still
 * registers under `voiceIdentityFor(userId)` so one inbound `<Client>` rings
 * all of them. The suffix only keeps the phone's heartbeat from colliding
 * with the browser row, whose identity is the Twilio client name.
 */
export function mobilePresenceIdentity(
  userId: string,
  platform: MobilePresencePlatform,
  deviceId: string,
): string {
  const device = deviceId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  if (!device) throw new Error("A device id is required to track this phone.");
  return `${voiceIdentityFor(userId)}#${platform}#${device}`;
}
