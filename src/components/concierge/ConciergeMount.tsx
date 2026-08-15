import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from "react";

import { ConversationProvider } from "@elevenlabs/react";

const VoxConcierge = lazy((): Promise<{ default: typeof import("./VoxConcierge").VoxConcierge }> =>
  import("./VoxConcierge")
    .then((module) => ({ default: module.VoxConcierge }))
    // A dropped chunk (deploy swap, offline, dev restart) must never blank the app.
    .catch(() => ({ default: (() => <></>) as typeof import("./VoxConcierge").VoxConcierge })),
);

class ConciergeBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Client-only, lazily loaded mount for the Vox concierge so the voice SDK never
 * runs during SSR and never lands in the first paint bundle.
 */
export function ConciergeMount({ placement = "right" }: { placement?: "right" | "left" } = {}) {
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
    <ConciergeBoundary>
      <Suspense fallback={null}>
        <ConversationProvider>
          <VoxConcierge placement={placement} />
        </ConversationProvider>
      </Suspense>
    </ConciergeBoundary>
  );
}
