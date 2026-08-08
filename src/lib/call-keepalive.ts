/**
 * Keeps an in-progress call alive and unmuted when the user switches apps or
 * locks focus away from SixVox.
 *
 * Browsers never mute a live getUserMedia track on backgrounding, but two
 * things can make it *sound* muted: a suspended AudioContext (mobile Safari
 * suspends them on hide) and the screen sleeping in a PWA. This module resumes
 * every audio context on return to visibility and holds a screen wake lock for
 * the duration of the call.
 */

type WakeLockSentinel = { release: () => Promise<void>; addEventListener: (t: string, cb: () => void) => void };

let sentinel: WakeLockSentinel | null = null;

async function acquireWakeLock() {
  const nav = navigator as Navigator & {
    wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
  };
  if (!nav.wakeLock || sentinel) return;
  try {
    sentinel = await nav.wakeLock.request("screen");
    sentinel.addEventListener("release", () => {
      sentinel = null;
    });
  } catch {
    /* wake lock is a nicety, never a requirement */
  }
}

function releaseWakeLock() {
  void sentinel?.release().catch(() => {});
  sentinel = null;
}

/**
 * Start keepalive for an active call. `reassert` is called whenever the tab
 * becomes visible again so the caller can re-apply the intended mute state and
 * re-enable the local audio tracks.
 */
export function startCallKeepalive(reassert: () => void): () => void {
  if (typeof document === "undefined") return () => {};

  const onVisible = () => {
    if (document.visibilityState === "visible") {
      void acquireWakeLock();
      reassert();
    }
  };

  void acquireWakeLock();
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onVisible);
  window.addEventListener("pageshow", onVisible);

  return () => {
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onVisible);
    window.removeEventListener("pageshow", onVisible);
    releaseWakeLock();
  };
}

/** Re-enable every local audio track on a Twilio call and resume its context. */
export function reviveCallAudio(call: unknown, muted: boolean): void {
  const c = call as {
    mute?: (state: boolean) => void;
    _mediaHandler?: { stream?: MediaStream; onpcconnectionstatechange?: unknown };
    getLocalStream?: () => MediaStream | undefined;
  } | null;
  if (!c) return;
  try {
    const stream = c.getLocalStream?.() ?? c._mediaHandler?.stream;
    stream?.getAudioTracks().forEach((track) => {
      // A backgrounded page must never leave the mic track disabled.
      if (!muted && !track.enabled) track.enabled = true;
    });
    // Re-apply the user's intended mute state in case the SDK reset it.
    c.mute?.(muted);
  } catch {
    /* best effort */
  }
}
