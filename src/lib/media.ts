/** Browser microphone permission helpers for in-app calling. */

export type MicState = "unsupported" | "unknown" | "prompt" | "granted" | "denied";

export function micSupported(): boolean {
  return (
    typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

/** Read the current permission without prompting (falls back to "unknown"). */
export async function readMicPermission(): Promise<MicState> {
  if (!micSupported()) return "unsupported";
  try {
    const status = await navigator.permissions?.query({
      name: "microphone" as PermissionName,
    });
    if (status) return status.state as MicState;
  } catch {
    /* Safari/Firefox may not expose the microphone descriptor */
  }
  return "unknown";
}

/** Watch permission changes where the browser supports it. */
export async function watchMicPermission(cb: (state: MicState) => void): Promise<() => void> {
  if (!micSupported()) return () => {};
  try {
    const status = await navigator.permissions?.query({
      name: "microphone" as PermissionName,
    });
    if (!status) return () => {};
    const handler = () => cb(status.state as MicState);
    status.addEventListener("change", handler);
    return () => status.removeEventListener("change", handler);
  } catch {
    return () => {};
  }
}

export class MicPermissionError extends Error {
  state: MicState;
  constructor(message: string, state: MicState) {
    super(message);
    this.name = "MicPermissionError";
    this.state = state;
  }
}

/**
 * Prompt for the microphone and release the track immediately — the Twilio
 * device opens its own stream once a call starts. Throws a friendly error so
 * the UI can explain what to do instead of surfacing a raw DOMException.
 */
export async function ensureMicrophone(): Promise<void> {
  if (!micSupported()) {
    throw new MicPermissionError(
      "This browser can't access a microphone. Open SixVox in Safari or Chrome to make calls.",
      "unsupported",
    );
  }
  if (typeof window !== "undefined" && !window.isSecureContext) {
    throw new MicPermissionError("Microphone access needs a secure (https) connection.", "denied");
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
  } catch (err) {
    const name = (err as DOMException)?.name;
    if (name === "NotAllowedError" || name === "SecurityError") {
      throw new MicPermissionError(
        "Microphone access was blocked. Allow the microphone for SixVox in your browser or phone settings, then try again.",
        "denied",
      );
    }
    if (name === "NotFoundError" || name === "OverconstrainedError") {
      throw new MicPermissionError("No microphone was found on this device.", "unsupported");
    }
    throw new MicPermissionError(
      "Couldn't turn on your microphone. Close other apps using it and try again.",
      "unknown",
    );
  }
}
