import { isFeatureShipped, type FeatureFlag } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";

/** Visible label, not color alone, so the state is clear without the palette. */
export function ComingSoonBadge({ flag, className }: { flag?: FeatureFlag; className?: string }) {
  if (flag && isFeatureShipped(flag)) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-warning px-2 py-0.5 text-[0.68rem] font-semibold tracking-wide text-warning-foreground uppercase",
        className,
      )}
    >
      Coming soon
    </span>
  );
}
