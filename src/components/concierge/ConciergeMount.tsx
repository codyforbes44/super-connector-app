import { lazy, Suspense, useEffect, useState } from "react";

import { ConversationProvider } from "@elevenlabs/react";

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
    const scope = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const idle = scope.requestIdleCallback
      ? scope.requestIdleCallback(() => setReady(true), { timeout: 2500 })
      : window.setTimeout(() => setReady(true), 1200);
    return () => {
      if (scope.cancelIdleCallback) scope.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, []);

  if (!ready) return null;
  return (
    <Suspense fallback={null}>
      <ConversationProvider>
        <VoxConcierge />
      </ConversationProvider>
    </Suspense>
  );
}
