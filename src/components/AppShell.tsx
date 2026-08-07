import { Link, useRouterState } from "@tanstack/react-router";
import { Inbox, PhoneCall, Hash, Wand2, Settings } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

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
    <div className="app-gradient mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <main className="flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))]">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-lg border-t border-border bg-sidebar pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <ul className="grid grid-cols-5 px-1.5 py-1">
          {TABS.map((tab) => {
            const active = pathname.startsWith(tab.to);
            const Icon = tab.icon;
            return (
              <li key={tab.to}>
                <Link
                  to={tab.to}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2 text-[0.65rem] font-medium transition-colors",
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
    <header className="sticky top-0 z-30 border-b border-border bg-background/55 px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-3 backdrop-blur-xl">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display truncate text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {action}
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