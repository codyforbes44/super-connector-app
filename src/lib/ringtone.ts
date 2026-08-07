/**
 * A simple WebAudio ringtone so an incoming call is audible while the app is
 * open. No asset download — two alternating tones in a repeating cadence.
 */

let ctx: AudioContext | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let gain: GainNode | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  return ctx;
}

function burst() {
  const audio = context();
  if (!audio || !gain) return;
  const now = audio.currentTime;
  for (const [offset, freq] of [
    [0, 440],
    [0, 480],
  ] as const) {
    const osc = audio.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain);
    osc.start(now + offset);
    osc.stop(now + offset + 1.4);
  }
}

/** Start the ring loop. Safe to call repeatedly. */
export function startRingtone(): void {
  const audio = context();
  if (!audio || timer) return;
  void audio.resume().catch(() => {});
  gain = audio.createGain();
  gain.gain.value = 0.08;
  gain.connect(audio.destination);
  burst();
  timer = setInterval(burst, 3400);
}

/** Stop the ring loop and release the gain node. */
export function stopRingtone(): void {
  if (timer) clearInterval(timer);
  timer = null;
  try {
    gain?.disconnect();
  } catch {
    /* already torn down */
  }
  gain = null;
}