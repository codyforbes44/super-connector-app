import { Link } from "@tanstack/react-router";
import { CheckCircle2, Circle, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useBootstrap } from "@/hooks/useBootstrap";
import { checklistSteps } from "@/lib/onboarding-checklist";

const DISMISS_KEY = "sixvox.setup-checklist.dismissed";

/** Compact first-week checklist; hides itself when finished or dismissed. */
export function SetupChecklist() {
  const boot = useBootstrap();
  const [env, setEnv] = useState<{ notificationsOn: boolean; installed: boolean; dismissed: boolean } | null>(null);

  useEffect(() => {
    setEnv({
      notificationsOn: typeof Notification !== "undefined" && Notification.permission === "granted",
      installed:
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true,
      dismissed: localStorage.getItem(DISMISS_KEY) === "1",
    });
  }, []);

  if (!env || env.dismissed) return null;
  const steps = checklistSteps({
    numbers: boot.numbers as { webhook_wired?: boolean | null; answer_mode?: string | null }[],
    notificationsOn: env.notificationsOn,
    installed: env.installed,
  });
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;

  return (
    <section aria-labelledby="setup-title" className="mx-4 mt-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 id="setup-title" className="font-display text-base font-semibold">Finish setting up</h2>
          <p className="text-sm text-muted-foreground">{done} of {steps.length} done</p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="min-h-11 min-w-11"
          aria-label="Hide setup checklist"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setEnv({ ...env, dismissed: true });
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ol className="mt-2 space-y-1">
        {steps.map((s) => (
          <li key={s.id}>
            <Link to={s.to} className="flex min-h-11 items-center gap-3 rounded-xl px-2 py-2 hover:bg-accent">
              {s.done ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span className="min-w-0">
                <span className={s.done ? "block text-sm text-muted-foreground line-through" : "block text-sm font-medium"}>
                  {s.title}
                  <span className="sr-only">{s.done ? " (done)" : " (to do)"}</span>
                </span>
                <span className="block text-xs text-muted-foreground">{s.hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
