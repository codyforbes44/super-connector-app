/**
 * One map for marketing "coming soon" badges.
 * Flip a flag to true when that feature is on main — every badge reads this
 * object, so one edit removes the badge everywhere.
 */
export const FEATURE_FLAGS = {
  missedCallTextBack: false,
  businessHours: false,
  aiBookingWithApproval: false,
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
