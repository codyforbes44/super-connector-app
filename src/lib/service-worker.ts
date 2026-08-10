/**
 * Guarded service-worker registration for offline support.
 *
 * The worker is only ever registered in the published production app. In dev,
 * inside an iframe, on any Lovable preview host, or with ?sw=off, we actively
 * unregister it so a stale shell can never serve deleted chunks.
 */
const SW_URL = "/sw.js";

function isPreviewHost(hostname: string): boolean {
  return (
    hostname.startsWith("id-preview--") ||
    hostname.startsWith("preview--") ||
    hostname === "lovableproject.com" ||
    hostname.endsWith(".lovableproject.com") ||
    hostname === "lovableproject-dev.com" ||
    hostname.endsWith(".lovableproject-dev.com") ||
    hostname === "beta.lovable.dev" ||
    hostname.endsWith(".beta.lovable.dev")
  );
}

export function serviceWorkerAllowed(): boolean {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;
  if (!import.meta.env.PROD) return false;
  if (window.top !== window.self) return false;
  if (isPreviewHost(window.location.hostname)) return false;
  if (new URLSearchParams(window.location.search).has("sw=off".split("=")[0]!)) {
    if (new URLSearchParams(window.location.search).get("sw") === "off") return false;
  }
  return true;
}

async function unregisterAppWorker(): Promise<void> {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(
      registrations
        .filter((r) => (r.active ?? r.waiting ?? r.installing)?.scriptURL.endsWith(SW_URL))
        .map((r) => r.unregister()),
    );
  } catch {
    /* nothing to clean up */
  }
}

export async function registerAppServiceWorker(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (!serviceWorkerAllowed()) {
    await unregisterAppWorker();
    return;
  }
  try {
    await navigator.serviceWorker.register(SW_URL, { scope: "/" });
  } catch (error) {
    console.warn("Service worker registration failed", error);
  }
}
