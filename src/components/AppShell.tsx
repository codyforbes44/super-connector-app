import { Link, useRouterState } from "@tanstack/react-router";
import { Inbox, PhoneCall, Hash, Wand2, Settings } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { TrialBanner } from "@/components/TrialBanner";

const TABS = [
  { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/calls", label: "Calls", icon: PhoneCall },
  { to: "/numbers", label: "Numbers", icon: Hash },
  { to: "/tools", label: "Tools", icon: Wand2 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="app-gradient flex min-h-dvh w-full flex-col lg:flex-row">
      {/* Desktop / tablet side rail */}
      <aside className="sticky top-0 hidden h-dvh shrink-0 flex-col gap-2 border-r border-sidebar-border bg-sidebar px-3 py-6 backdrop-blur-xl lg:flex lg:w-[15rem]">
        <p className="font-display text-glow mb-4 px-3 text-lg font-semibold text-primary">SixVox</p>
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
              <Icon className="h-[1.15rem] w-[1.15rem] shrink-0" strokeWidth={active ? 2.4 : 1.9} />
              <span className="truncate">{tab.label}</span>
            </Link>
          );
        })}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <TrialBanner />
        <main className="mx-auto w-full max-w-lg flex-1 pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:max-w-2xl lg:max-w-4xl lg:pb-10 xl:max-w-5xl">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-lg border-t border-border bg-sidebar pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:max-w-2xl lg:hidden">
        <ul className="grid grid-cols-5 px-1.5 py-1">
          {TABS.map((tab) => {
            const active = pathname.startsWith(tab.to);
            const Icon = tab.icon;
            return (
              <li key={tab.to}>
                <Link
                  to={tab.to}
                  className={cn(
                    "flex min-h-11 flex-col items-center gap-1 py-2 text-[0.65rem] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-12 items-center justify-center rounded-full transition-all",
                      active ? "key-signal" : "key-raised opacity-70",
                    )}
                  >
                    <Icon className="h-[1.15rem] w-[1.15rem]" strokeWidth={active ? 2.4 : 1.9} />
                  </span>
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
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
    <header className="sticky top-0 z-30 border-b border-border bg-background/55 px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-3 backdrop-blur-xl sm:px-6 lg:pt-6">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display truncate text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <div className="shrink-0">{action}</div>
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