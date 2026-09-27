import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { Button } from "@/components/ui/button";

/* -------------------------------------------------------------------------
 * Screen — safe-area aware page body with optional pull-to-refresh.
 * ---------------------------------------------------------------------- */

export function Screen({
  children,
  className,
  onRefresh,
}: {
  children: ReactNode;
  className?: string;
  onRefresh?: () => Promise<unknown> | void;
}) {
  return (
    <div
      className={cn(
        // Keep line lengths readable on wide displays; phones are unaffected.
        "mx-auto w-full max-w-6xl px-3 pt-1 pb-6 sm:px-5 lg:px-6",
        className,
      )}
    >
      {onRefresh ? <PullToRefresh onRefresh={onRefresh} /> : null}
      {children}
    </div>
  );
}

/** Lightweight pull-to-refresh for touch devices. Never blocks normal scroll. */
export function PullToRefresh({ onRefresh }: { onRefresh: () => Promise<unknown> | void }) {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef<number | null>(null);

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      if (window.scrollY > 0 || busy) return;
      start.current = e.touches[0]?.clientY ?? null;
    };
    const onMove = (e: TouchEvent) => {
      if (start.current === null) return;
      const delta = (e.touches[0]?.clientY ?? 0) - start.current;
      setPull(delta > 0 ? Math.min(delta * 0.5, 72) : 0);
    };
    const onEnd = async () => {
      const distance = pull;
      start.current = null;
      setPull(0);
      if (distance < 56 || busy) return;
      setBusy(true);
      haptic("light");
      try {
        await onRefresh();
      } finally {
        setBusy(false);
      }
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [pull, busy, onRefresh]);

  if (!pull && !busy) return null;
  return (
    <div
      className="flex items-center justify-center overflow-hidden transition-[height]"
      style={{ height: busy ? 40 : pull }}
      aria-hidden
    >
      <span
        className={cn(
          "h-5 w-5 rounded-full border-2 border-border border-t-primary",
          busy && "animate-spin",
        )}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Section + list primitives
 * ---------------------------------------------------------------------- */

export function Section({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mt-5 first:mt-2", className)}>
      {title || action ? (
        <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-1">
          <div className="min-w-0">
            {title ? (
              <h2 className="truncate text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Grouped list card with hairline dividers between rows. */
export function ListGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "hairline-list overflow-hidden rounded-lg border border-border bg-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

type RowBase = {
  icon?: LucideIcon;
  iconClassName?: string;
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  trailing?: ReactNode;
  chevron?: boolean;
  className?: string;
  destructive?: boolean;
};

function RowInner({
  icon: Icon,
  iconClassName,
  leading,
  title,
  subtitle,
  value,
  trailing,
  chevron,
  destructive,
}: RowBase) {
  return (
    <>
      {leading ??
        (Icon ? (
          <span
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-foreground",
              iconClassName,
            )}
          >
            <Icon className="h-[1.05rem] w-[1.05rem]" strokeWidth={2} />
          </span>
        ) : null)}
      <span className="min-w-0 flex-1 text-left">
        <span
          className={cn("block truncate text-sm font-medium", destructive && "text-destructive")}
        >
          {title}
        </span>
        {subtitle ? (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>
      {value ? (
        <span className="shrink-0 text-xs text-muted-foreground tabular">{value}</span>
      ) : null}
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
      {chevron ? (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      ) : null}
    </>
  );
}

const rowClasses = "flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors";

export function Row({ onClick, ...props }: RowBase & { onClick?: () => void }) {
  if (!onClick) {
    return (
      <div className={cn(rowClasses, props.className)}>
        <RowInner {...props} />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        haptic("light");
        onClick();
      }}
      className={cn(rowClasses, "hover:bg-accent active:bg-accent", props.className)}
    >
      <RowInner {...props} />
    </button>
  );
}

export function LinkRow({
  to,
  params,
  search,
  ...props
}: RowBase & Pick<ComponentProps<typeof Link>, "to" | "params" | "search">) {
  return (
    <Link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {...({ to, params, search } as any)}
      className={cn(rowClasses, "hover:bg-accent active:bg-accent", props.className)}
    >
      <RowInner {...props} chevron={props.chevron ?? true} />
    </Link>
  );
}

/* -------------------------------------------------------------------------
 * States
 * ---------------------------------------------------------------------- */

export function Empty({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center" role="status">
      {Icon ? (
        <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-secondary">
          <Icon className="h-5 w-5 text-primary" aria-hidden />
        </span>
      ) : null}
      <p className="font-display text-lg font-semibold text-balance">{title}</p>
      {description ? (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-card px-5 py-6 text-center">
      <p className="font-display text-sm font-semibold text-foreground">{title}</p>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      {onRetry ? (
        <Button type="button" variant="secondary" onClick={onRetry} className="mt-4">
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-muted", className)} />;
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ListGroup>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex min-h-14 items-center gap-3 px-4 py-3">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="mt-2 h-3 w-2/3" />
          </div>
        </div>
      ))}
    </ListGroup>
  );
}

/* -------------------------------------------------------------------------
 * Pagination + async list — one shared implementation of loading / empty /
 * error / "load more" behaviour used by every authenticated screen.
 * ---------------------------------------------------------------------- */

export const DEFAULT_PAGE_SIZE = 25;

/** Incremental client-side pagination over an already-fetched array. */
export function usePagedList<T>(items: T[], pageSize = DEFAULT_PAGE_SIZE) {
  const [visible, setVisible] = useState(pageSize);
  const total = items.length;

  // Reset paging whenever the underlying collection shrinks (filter/search).
  useEffect(() => {
    setVisible((current) => (current > pageSize && total <= pageSize ? pageSize : current));
  }, [total, pageSize]);

  const loadMore = useCallback(() => {
    setVisible((current) => current + pageSize);
  }, [pageSize]);

  return {
    items: items.slice(0, visible),
    hasMore: total > visible,
    remaining: Math.max(0, total - visible),
    total,
    loadMore,
    reset: useCallback(() => setVisible(pageSize), [pageSize]),
  };
}

/** "Load more" affordance that also auto-loads when scrolled into view. */
export function LoadMore({
  hasMore,
  remaining,
  onLoadMore,
  className,
}: {
  hasMore: boolean;
  remaining?: number;
  onLoadMore: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasMore) return;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
      },
      { rootMargin: "240px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

  if (!hasMore) return null;
  return (
    <div ref={ref} className={cn("flex justify-center py-4", className)}>
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          haptic("light");
          onLoadMore();
        }}
      >
        {remaining ? `Load ${remaining > 25 ? "25 more" : `${remaining} more`}` : "Load more"}
      </Button>
    </div>
  );
}

export type AsyncQuery = {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  refetch?: () => unknown;
};

/**
 * Renders the canonical loading / error / empty / paged-content sequence for a
 * list-backed query so every screen behaves identically.
 */
export function AsyncList<T>({
  query,
  items,
  children,
  skeletonRows = 5,
  pageSize = DEFAULT_PAGE_SIZE,
  paginate = true,
  empty,
  errorTitle = "Couldn't load this list",
  errorDescription,
  className,
}: {
  query: AsyncQuery;
  items: T[];
  children: (items: T[]) => ReactNode;
  skeletonRows?: number;
  pageSize?: number;
  paginate?: boolean;
  empty: ReactNode;
  errorTitle?: string;
  errorDescription?: string;
  className?: string;
}) {
  const paged = usePagedList(items, paginate ? pageSize : Number.MAX_SAFE_INTEGER);

  if (query.isLoading) {
    return (
      <div className={className}>
        <ListSkeleton rows={skeletonRows} />
      </div>
    );
  }

  if (query.isError) {
    const description = errorDescription ?? asMessage(query.error);
    return (
      <div className={className}>
        <ErrorState
          title={errorTitle}
          {...(description ? { description } : {})}
          {...(query.refetch ? { onRetry: () => void query.refetch?.() } : {})}
        />
      </div>
    );
  }

  if (items.length === 0) return <div className={className}>{empty}</div>;

  return (
    <div className={className}>
      {children(paged.items)}
      <LoadMore hasMore={paged.hasMore} remaining={paged.remaining} onLoadMore={paged.loadMore} />
    </div>
  );
}

function asMessage(error: unknown) {
  if (!error) return undefined;
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : undefined;
}

/* -------------------------------------------------------------------------
 * Field — labelled input with mobile keyboard hints
 * ---------------------------------------------------------------------- */

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (props: { id: string }) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="px-4 py-3">
      <label htmlFor={id} className="block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="mt-1.5">{children({ id })}</div>
      {error ? (
        <p className="mt-1.5 text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Small status pill used on config rows. */
export function StatusPill({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "success" | "warning" | "danger";
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-secondary text-muted-foreground",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    danger: "bg-destructive/15 text-destructive",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[0.68rem] font-semibold",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function useRefreshHandler(fn: () => Promise<unknown> | void) {
  return useCallback(() => fn(), [fn]);
}
