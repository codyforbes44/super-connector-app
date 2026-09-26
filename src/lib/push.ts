import { PUSH_SW_URL, VAPID_PUBLIC_KEY } from "./push-config";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function pushPermission(): NotificationPermission | "unsupported" {
  if (!pushSupported()) return "unsupported";
  return Notification.permission;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration(PUSH_SW_URL);
  if (existing) return existing;
  return navigator.serviceWorker.register(PUSH_SW_URL, { scope: "/" });
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration(PUSH_SW_URL);
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

export type SerializedSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string;
};

function serialize(sub: PushSubscription): SerializedSubscription {
  const json = sub.toJSON() as { keys?: { p256dh?: string; auth?: string } };
  return {
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? "",
    userAgent: navigator.userAgent.slice(0, 200),
  };
}

/** Ask for permission, register the worker and return the subscription payload. */
export async function enablePush(): Promise<SerializedSubscription> {
  if (!pushSupported()) throw new Error("This browser can't receive push notifications.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was declined.");

  const reg = await registration();
  await navigator.serviceWorker.ready;

  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    }));

  return serialize(sub);
}

export async function disablePush(): Promise<string | null> {
  const sub = await currentSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  return endpoint;
}

/**
 * Close any sticky "Incoming call" notification. The page can close
 * notifications on a registration directly, which works whether the push
 * handler lives in the controlling worker (production) or in the standalone
 * push worker (dev/preview).
 */
export async function clearCallNotifications(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs.map(async (reg) => {
        const open = await reg.getNotifications();
        for (const notification of open) {
          const kind = (notification.data as { type?: string } | undefined)?.type;
          if (kind === "call") notification.close();
        }
        reg.active?.postMessage({ type: "clear-call-notifications" });
      }),
    );
  } catch {
    /* clearing notifications is best-effort */
  }
}
