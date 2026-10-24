import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { Activity, Bot, Hash, LayoutDashboard, ScrollText, ShieldCheck, Users, Building2 } from "lucide-react";

import { ScreenHeader } from "@/components/AppShell";
import { Empty, ListSkeleton, Screen } from "@/components/screen";
import { useSubscription } from "@/hooks/useSubscription";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/platform", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/platform/accounts", label: "Accounts", icon: Users },
  { to: "/platform/workspaces", label: "Teams", icon: Building2 },
  { to: "/platform/numbers", label: "Numbers", icon: Hash },
  { to: "/platform/health", label: "Health", icon: Activity },
  { to: "/platform/ai", label: "AI", icon: Bot },
  { to: "/platform/audit", label: "Audit", icon: ScrollText },
] as const;

export const Route = createFileRoute("/_authenticated/platform")({
  head: () => ({
    meta: [
      { title: "Platform admin — SixVox" },
      { name: "description", content: "SixVox platform controls for super admins." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlatformLayout,
});

function PlatformLayout() {
  const { isSuperAdmin, loading } = useSubscription();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (loading) {
    return (
      <Screen>
        <ListSkeleton rows={4} />
      </Screen>
    );
  }
  if (!isSuperAdmin) {
    return (
      <Screen>
        <Empty
          icon={ShieldCheck}
          title="Platform admins only"
          description="This area is for SixVox platform administrators."
        />
      </Screen>
    );
  }

  return (
    <div className="min-w-0">
      <ScreenHeader title="Platform admin" subtitle="Super admin controls" />
      <nav
        aria-label="Platform sections"
        className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur"
      >
        <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 py-2 sm:px-5 lg:px-6 [scrollbar-width:none]">
          {TABS.map((tab) => {
            const active = "exact" in tab ? pathname === tab.to || pathname === `${tab.to}/` : pathname.startsWith(tab.to);
            const Icon = tab.icon;
            return (
              <li key={tab.to} className="shrink-0">
                <Link
                  to={tab.to}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <Outlet />
    </div>
  );
}
