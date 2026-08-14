import { lazy, Suspense, useEffect, useState } from "react";

const VoxConcierge = lazy(() =>
  import("./VoxConcierge").then((module) => ({ default: module.VoxConcierge })),
);

/**
 * Client-only, lazily loaded mount for the Vox concierge so the voice SDK never
 * runs during SSR and never lands in the first paint bundle.
 */
export function ConciergeMount() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const idle =
      "requestIdleCallback" in window
        ? window.requestIdleCallback(() => setReady(true), { timeout: 2500 })
        : window.setTimeout(() => setReady(true), 1200);
    return () => {
      if ("cancelIdleCallback" in window) window.cancelIdleCallback(idle as number);
      else window.clearTimeout(idle as number);
    };
  }, []);

  if (!ready) return null;
  return (
    <Suspense fallback={null}>
      <VoxConcierge />
    </Suspense>
  );
}
