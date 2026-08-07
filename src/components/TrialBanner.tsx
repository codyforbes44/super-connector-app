import { Link } from "@tanstack/react-router";

import { useSubscription } from "@/hooks/useSubscription";

export function TrialBanner() {
  const { subscription, isSuperAdmin } = useSubscription();
  if (isSuperAdmin || !subscription || subscription.status !== "trialing") return null;

  const endsAt = subscription.trial_ends_at ?? subscription.current_period_end;
  if (!endsAt) return null;

  const days = Math.max(
    0,
    Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86_400_000),
  );

  return (
    <Link
      to="/billing"
      className="flex items-center justify-between gap-3 border-b border-border bg-primary/10 px-4 py-2 text-xs"
    >
      <span className="min-w-0 truncate text-muted-foreground">
        {days > 0
          ? `${days} day${days === 1 ? "" : "s"} left in your free trial`
          : "Your free trial has ended"}
      </span>
      <span className="shrink-0 font-semibold text-primary">Choose a plan</span>
    </Link>
  );
}