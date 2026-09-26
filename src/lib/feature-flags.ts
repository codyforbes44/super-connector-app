/**
 * One map for marketing "coming soon" badges.
 * Flip a flag to true when that feature is on main — every badge reads this
 * object, so one edit removes the badge everywhere.
 */
export const FEATURE_FLAGS = {
  /** Line settings: text an unanswered inbound caller. Off until the owner turns it on. */
  missedCallTextBack: true,
  /** Line settings: weekly hours, holidays, and after-hours AI or voicemail. */
  businessHours: true,
  /** Line settings plus Calls: Google Calendar proposal the owner approves. Automatic is optional. */
  aiBookingWithApproval: true,
  jobber: false,
  reviewRequests: false,
  paymentLinks: false,
  nativeApp: false,
  portIn: false,
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export function isFeatureShipped(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag];
}
