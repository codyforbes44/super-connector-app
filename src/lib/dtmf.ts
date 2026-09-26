/**
 * Real DTMF keypad tones, generated with WebAudio so there is no asset to
 * download. Each key plays its standard low+high frequency pair, exactly like
 * a hardware phone, paired with the dialpad's haptic tick.
 */
import { registerAudioContext } from "@/lib/call-keepalive";

const LOW: Record<string, number> = {
  "1": 697,
  "2": 697,
  "3": 697,
  "4": 770,
  "5": 770,
  "6": 770,
  "7": 852,
  "8": 852,
  "9": 852,
  "*": 941,
  "0": 941,
  "#": 941,
};
const HIGH: Record<string, number> = {
  "1": 1209,
  "2": 1336,
  "3": 1477,
  "4": 1209,
  "5": 1336,
  "6": 1477,
  "7": 1209,
  "8": 1336,
  "9": 1477,
  "*": 1209,
  "0": 1336,
  "#": 1477,
};

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    ctx = new Ctor();
    registerAudioContext(ctx);
  }
  // Mobile browsers suspend the context until a user gesture — key presses are one.
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  return ctx;
}

/** Play the tone for a dialpad key. Silently no-ops where audio is unavailable. */
export function playDtmf(digit: string, durationMs = 120): void {
  const low = LOW[digit];
  const high = HIGH[digit];
  if (low === undefined || high === undefined) return;

  const audio = context();
  if (!audio) return;

  try {
    const now = audio.currentTime;
    const end = now + durationMs / 1000;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.012);
    gain.gain.setValueAtTime(0.14, end - 0.02);
    gain.gain.linearRampToValueAtTime(0, end);
    gain.connect(audio.destination);

    for (const freq of [low, high]) {
      const osc = audio.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(now);
      osc.stop(end);
      osc.onended = () => {
        try {
          osc.disconnect();
        } catch {
          /* already torn down */
        }
      };
    }

    window.setTimeout(() => {
      try {
        gain.disconnect();
      } catch {
        /* already torn down */
      }
    }, durationMs + 60);
  } catch {
    /* audio blocked — haptics still fire */
  }
}
