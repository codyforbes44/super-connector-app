/**
 * Small haptic feedback helper.
 *
 * Uses the Vibration API where available (Android Chrome, most mobile
 * browsers). iOS Safari ignores it silently, so calls are always safe.
 */
export type HapticStrength = "light" | "medium" | "heavy" | "error";

const PATTERNS: Record<HapticStrength, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 35,
  error: [20, 40, 20],
};

export function haptic(strength: HapticStrength = "light") {
  if (typeof navigator === "undefined") return;
  const vibrate = navigator.vibrate?.bind(navigator);
  if (!vibrate) return;
  try {
    vibrate(PATTERNS[strength]);
  } catch {
    /* some browsers throw when the page isn't focused */
  }
}
