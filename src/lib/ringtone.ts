/**
 * Audible ring for an incoming call while the app is open.
 *
 * Two layers, because mobile browsers are fussy about unattended audio:
 *  1. A looping <audio> element on the bundled ring-back tone — this is what
 *     actually gets heard on iOS/Android, and it keeps playing when the tab is
 *     hidden.
 *  2. A WebAudio cadence as a fallback if the element is blocked or the file
 *     can't load.
 *
 * `primeRingtone()` is called from the first user gesture in the app so the
 * autoplay policy is already satisfied when a call lands.
 */

import { registerAudioContext } from "@/lib/call-keepalive";

const RING_SRC = "/ringback.mp3";

let el: HTMLAudioElement | null = null;
let elPlaying = false;

let ctx: AudioContext | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let gain: GainNode | null = null;
let vibrationTimer: ReturnType<typeof setInterval> | null = null;
let ringGeneration = 0;
let ringing = false;

function element(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!el) {
    el = new Audio(RING_SRC);
    el.loop = true;
    el.preload = "auto";
    el.volume = 1;
  }
  return el;
}

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
  return ctx;
}

/**
 * Unlock audio playback from a user gesture. Safe and cheap to call often —
 * it plays the ring muted for a moment so the browser marks it as allowed.
 */
export function primeRingtone(): void {
  const audio = element();
  if (audio && audio.paused) {
    const wasMuted = audio.muted;
    audio.muted = true;
    void audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = wasMuted;
      })
      .catch(() => {
        audio.muted = wasMuted;
      });
  }
  const c = context();
  if (c) {
    void c
      .resume()
      .then(() => {
        // A zero-gain source started inside the gesture is the reliable iOS
        // audio unlock. Merely resuming a context is not enough on every build.
        const oscillator = c.createOscillator();
        const silent = c.createGain();
        silent.gain.value = 0;
        oscillator.connect(silent);
        silent.connect(c.destination);
        oscillator.start();
        oscillator.stop(c.currentTime + 0.01);
      })
      .catch(() => {});
  }
}

function startVibration() {
  if (typeof navigator === "undefined" || !("vibrate" in navigator) || vibrationTimer) return;
  const pulse = () => navigator.vibrate([500, 250, 500, 1750]);
  pulse();
  vibrationTimer = setInterval(pulse, 3000);
}

function stopVibration() {
  if (vibrationTimer) clearInterval(vibrationTimer);
  vibrationTimer = null;
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(0);
}

function burst() {
  const audio = context();
  if (!audio || !gain) return;
  const now = audio.currentTime;
  for (const freq of [440, 480]) {
    const osc = audio.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 1.4);
  }
}

function startTones() {
  const audio = context();
  if (!audio || timer) return;
  void audio.resume().catch(() => {});
  gain = audio.createGain();
  gain.gain.value = 0.5;
  gain.connect(audio.destination);
  burst();
  timer = setInterval(burst, 3400);
}

function stopTones() {
  if (timer) clearInterval(timer);
  timer = null;
  try {
    gain?.disconnect();
  } catch {
    /* already torn down */
  }
  gain = null;
}

/**
 * Start the ring loop. Safe to call repeatedly: a second start for a ring that
 * is already running is a no-op, so two callers (the voice device and the
 * in-call screen) can both ask for the ring without cancelling each other.
 */
export function startRingtone(): void {
  if (ringing) return;
  const generation = ++ringGeneration;
  ringing = true;
  startVibration();
  const audioContext = context();
  if (audioContext?.state === "suspended") void audioContext.resume().catch(() => {});
  const audio = element();
  if (audio) {
    audio.currentTime = 0;
    audio.muted = false;
    void audio
      .play()
      .then(() => {
        if (generation !== ringGeneration || !ringing) {
          audio.pause();
          return;
        }
        elPlaying = true;
      })
      .catch(() => {
        // Blocked or missing asset — fall back to synthesised ringing,
        // but only if this ring is still the current one.
        elPlaying = false;
        if (generation === ringGeneration && ringing) startTones();
      });
  } else {
    startTones();
  }
}

/** Stop every ring layer. */
export function stopRingtone(): void {
  ringGeneration++;
  ringing = false;
  stopVibration();
  if (el) {
    try {
      el.pause();
      el.currentTime = 0;
    } catch {
      /* nothing playing */
    }
  }
  elPlaying = false;
  stopTones();
}

/** True while the app is audibly ringing through the audio element. */
export function isRingtonePlaying(): boolean {
  return elPlaying || timer !== null;
}
