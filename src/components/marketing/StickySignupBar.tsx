import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Phone-only signup bar. It slides in once the visitor has scrolled past the
 * hero CTA so the trial is always one thumb-tap away.
 */
export function StickySignupBar() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > 560);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] transition-transform duration-300 sm:hidden",
        shown ? "translate-y-0" : "translate-y-[130%]",
      )}
    >
      <div className="glass-panel flex items-center gap-3 rounded-full py-2 pr-2 pl-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.8rem] font-semibold">Try SixVox free</p>
          <p className="truncate text-[0.65rem] text-muted-foreground">14 days · no card</p>
        </div>
        <Link
          to="/auth"
          search={{ mode: "signup" }}
          className="key-signal inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-5 text-sm font-semibold"
        >
          Start
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}