import { Link, useRouterState } from "@tanstack/react-router";
import { Inbox, PhoneCall, Hash, Wand2, Settings, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";
import { TrialBanner } from "@/components/TrialBanner";
import { useForcedDarkTheme } from "@/lib/theme";
import { ConciergeMount } from "@/components/concierge/ConciergeMount";

const TABS = [
  { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/calls", label: "Calls", icon: PhoneCall },
  { to: "/numbers", label: "Numbers", icon: Hash },
  { to: "/tools", label: "Tools", icon: Wand2 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export type ScreenFab = { icon: LucideIcon; label: string; onClick: () => void };

const FabContext = createContext<{ set: (fab: ScreenFab | null) => void }>({ set: () => {} });

/**
 * Lets a screen own the floating action button that sits beside the tab pod.
 * The registration is cleared automatically when the screen unmounts.
 */
export function useScreenFab(fab: ScreenFab) {
  const { set } = useContext(FabContext);
  const { icon, label, onClick } = fab;
  useEffect(() => {
    set({ icon, label, onClick });
    return () => set(null);
  }, [set, icon, label, onClick]);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // The in-app experience is dark-only; the public site's preference is
  // restored when the shell unmounts.
  useForcedDarkTheme();
  const [fab, setFab] = useState<ScreenFab | null>(null);
  const set = useCallback((next: ScreenFab | null) => setFab(next), []);
  const fabValue = useMemo(() => ({ set }), [set]);
  const FabIcon = fab?.icon ?? Plus;

  return (
    <FabContext.Provider value={fabValue}>
      <div className="app-gradient flex min-h-dvh w-full flex-col lg:flex-row">
        {/* Desktop / tablet side rail */}
        <aside className="sticky top-0 hidden h-dvh shrink-0 flex-col gap-2 border-r border-sidebar-border bg-sidebar px-3 py-6 backdrop-blur-xl lg:flex lg:w-[15rem]">
          <p className="font-display text-glow mb-4 px-3 text-lg font-semibold text-primary">
            SixVox
          </p>
          {TABS.map((tab) => {
            const active = pathname.startsWith(tab.to);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-2xl px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-primary ring-glow"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                <Icon
                  className="h-[1.15rem] w-[1.15rem] shrink-0"
                  strokeWidth={active ? 2.4 : 1.9}
                />
                <span className="truncate">{tab.label}</span>
              </Link>
            );
          })}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <TrialBanner />
          <main className="mx-auto w-full max-w-lg min-w-0 flex-1 overflow-x-clip pb-[calc(6.25rem+env(safe-area-inset-bottom))] md:max-w-3xl lg:max-w-5xl lg:pb-10 xl:max-w-7xl">
            {children}
          </main>
          <ConciergeMount placement="left" />
        </div>

        {/* Mobile: edge-anchored tab bar plus a single primary action button */}
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 lg:hidden">
          <nav className="pointer-events-auto border-t border-primary/25 bg-card px-1 pt-1 pb-[calc(env(safe-area-inset-bottom)+0.35rem)]">
            <ul className="grid grid-cols-5">
              {TABS.map((tab) => {
                const active = pathname.startsWith(tab.to);
                const Icon = tab.icon;
                return (
                  <li key={tab.to}>
                    <Link
                      to={tab.to}
                      className={cn(
                        "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[0.6rem] font-medium transition-colors",
                        active ? "text-primary" : "text-muted-foreground hover:text-primary/80",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-8 w-11 items-center justify-center rounded-xl transition-colors",
                          active
                            ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                            : "opacity-80",
                        )}
                      >
                        <Icon
                          className="h-[1.15rem] w-[1.15rem]"
                          strokeWidth={active ? 2.4 : 1.9}
                        />
                      </span>
                      <span className="truncate">{tab.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          {fab ? (
            <button
              type="button"
              onClick={fab.onClick}
              className="key-call pointer-events-auto absolute right-4 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg transition-transform active:scale-95"
            >
              <FabIcon className="h-6 w-6" />
              <span className="sr-only">{fab.label}</span>
            </button>
          ) : null}
        </div>

        {/* Desktop: the same primary action floats bottom-right */}
        {fab ? (
          <button
            type="button"
            onClick={fab.onClick}
            className="key-call fixed right-8 bottom-8 z-40 hidden h-14 w-14 items-center justify-center rounded-xl transition-transform active:scale-95 lg:flex"
          >
            <FabIcon className="h-6 w-6" />
            <span className="sr-only">{fab.label}</span>
          </button>
        ) : null}
      </div>
    </FabContext.Provider>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 px-4 pt-[calc(env(safe-area-inset-top)+0.6rem)] pb-2.5 backdrop-blur sm:px-5 lg:pt-5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="font-display truncate text-xl leading-tight font-semibold tracking-tight sm:text-2xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="truncate text-[0.7rem] text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-1">{action}</div> : null}
      </div>
    </header>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof Inbox;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
      <span className="key-raised mb-4 flex h-16 w-16 items-center justify-center rounded-full">
        <Icon className="h-6 w-6 text-primary" />
      </span>
      <p className="font-display text-base font-semibold">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
