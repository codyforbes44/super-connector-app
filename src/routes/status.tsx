import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";

import { MarketingLayout, Section } from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";
import { pageHead } from "@/lib/seo";

const TITLE = "SixVox status — is everything working?";
const DESCRIPTION = "Live status of the SixVox app and its database, checked when you open this page.";

export const Route = createFileRoute("/status")({
  head: () => pageHead({ path: "/status", title: TITLE, description: DESCRIPTION }),
  component: StatusPage,
});

type Health = { ok: boolean; components: Record<string, "up" | "down">; checkedAt: string };

const NAMES: Record<string, string> = { app: "App and website", database: "Calls, texts and account data" };

function StatusPage() {
  const q = useQuery({
    queryKey: ["public-health"],
    queryFn: async (): Promise<Health> => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10_000);
      try {
        const r = await fetch("/api/public/health", { signal: ctrl.signal, cache: "no-store" });
        return (await r.json()) as Health;
      } finally {
        clearTimeout(t);
      }
    },
    retry: 1,
    refetchInterval: 60_000,
  });
  return (
    <MarketingLayout>
      <Section className="max-w-2xl">
        <h1 className="font-display text-3xl font-semibold">System status</h1>
        <div role="status" aria-live="polite" className="mt-6 rounded-2xl border border-border bg-card p-5">
          {q.isPending ? (
            <p className="flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" aria-hidden /> Checking…</p>
          ) : q.isError ? (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm font-medium"><CircleAlert className="size-5 text-destructive" aria-hidden /> We couldn't reach SixVox just now.</p>
              <Button className="min-h-11" onClick={() => q.refetch()}>Try again</Button>
            </div>
          ) : (
            <>
              <p className="flex items-center gap-2 text-base font-semibold">
                {q.data.ok ? <CheckCircle2 className="size-5 text-primary" aria-hidden /> : <CircleAlert className="size-5 text-destructive" aria-hidden />}
                {q.data.ok ? "All systems working" : "Some systems are having trouble"}
              </p>
              <ul className="mt-4 divide-y divide-border">
                {Object.entries(q.data.components).map(([key, state]) => (
                  <li key={key} className="flex min-h-11 items-center justify-between text-sm">
                    <span>{NAMES[key] ?? key}</span>
                    <span className={state === "up" ? "text-primary" : "text-destructive"}>{state === "up" ? "Working" : "Down"}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">Checked {new Date(q.data.checkedAt).toLocaleTimeString()} · rechecks every minute</p>
            </>
          )}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Problem not shown here? Call or text 580-217-8444 or email support@3bi.io.</p>
      </Section>
    </MarketingLayout>
  );
}
