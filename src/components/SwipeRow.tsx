import { useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type Action = {
  label: string;
  icon: ReactNode;
  onAction: () => void;
  tone?: "signal" | "muted";
};

const THRESHOLD = 72;

/**
 * A list row that reveals one action on each side while dragging horizontally.
 * Pointer-based so it works with touch and mouse; vertical scrolling is never
 * captured because we only take over once the gesture is clearly horizontal.
 */
export function SwipeRow({
  children,
  left,
  right,
  className,
}: {
  children: ReactNode;
  left?: Action | undefined;
  right?: Action | undefined;
  className?: string | undefined;
}) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; active: boolean } | null>(null);

  function reset() {
    start.current = null;
    setDx(0);
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {left ? (
        <div
          className={cn(
            "absolute inset-y-0 left-0 flex w-32 items-center gap-2 pl-5 text-xs font-semibold",
            left.tone === "muted" ? "text-muted-foreground" : "text-primary",
            dx > 8 ? "opacity-100" : "opacity-0",
          )}
        >
          {left.icon}
          {left.label}
        </div>
      ) : null}
      {right ? (
        <div
          className={cn(
            "absolute inset-y-0 right-0 flex w-32 items-center justify-end gap-2 pr-5 text-xs font-semibold",
            right.tone === "muted" ? "text-muted-foreground" : "text-primary",
            dx < -8 ? "opacity-100" : "opacity-0",
          )}
        >
          {right.label}
          {right.icon}
        </div>
      ) : null}

      <div
        style={{ transform: `translateX(${dx}px)` }}
        className={cn("relative bg-background/0", start.current?.active ? "" : "transition-transform")}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          start.current = { x: e.clientX, y: e.clientY, active: false };
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          const deltaX = e.clientX - s.x;
          const deltaY = e.clientY - s.y;
          if (!s.active) {
            if (Math.abs(deltaY) > Math.abs(deltaX)) {
              start.current = null;
              return;
            }
            if (Math.abs(deltaX) < 12) return;
            s.active = true;
          }
          const bounded = Math.max(-120, Math.min(120, deltaX));
          setDx(!left && bounded > 0 ? 0 : !right && bounded < 0 ? 0 : bounded);
        }}
        onPointerUp={() => {
          if (dx > THRESHOLD) left?.onAction();
          else if (dx < -THRESHOLD) right?.onAction();
          reset();
        }}
        onPointerCancel={reset}
        onPointerLeave={reset}
      >
        {children}
      </div>
    </div>
  );
}
