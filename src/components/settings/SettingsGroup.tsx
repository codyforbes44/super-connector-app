import { Link } from "@tanstack/react-router";
import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Tone = "cyan" | "green" | "violet" | "amber" | "red";

const TONE: Record<Tone, string> = {
  cyan: "bg-primary/18 text-primary",
  green: "bg-success/18 text-success",
  violet: "bg-violet/18 text-violet",
  amber: "bg-warning/18 text-warning",
  red: "bg-destructive/18 text-destructive",
};

/** A titled block of settings rows, iOS-style. */
export function SettingsGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="px-4 py-4">
      <h2 className="px-1 pb-2 text-[0.7rem] font-semibold tracking-wider text-muted-foreground uppercase">
        {title}
      </h2>
      {description ? (
        <p className="px-1 pb-2 text-xs text-muted-foreground">{description}</p>
      ) : null}
      <div className="hairline-list overflow-hidden rounded-lg border border-border bg-card">
        {children}
      </div>
    </section>
  );
}

function Body({
  icon: Icon,
  tone,
  title,
  description,
  value,
}: {
  icon: LucideIcon;
  tone: Tone;
  title: string;
  description?: string;
  value?: string;
}) {
  return (
    <>
      <span
        className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", TONE[tone])}
      >
        <Icon className="size-[1.05rem]" />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[0.95rem] font-medium">{title}</span>
        {description ? (
          <span className="block truncate text-[0.75rem] text-muted-foreground">{description}</span>
        ) : null}
      </span>
      {value ? (
        <span className="shrink-0 truncate text-[0.78rem] text-muted-foreground">{value}</span>
      ) : null}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </>
  );
}

const ROW =
  "flex min-h-14 w-full items-center justify-start gap-3 rounded-none px-3.5 py-2.5 text-foreground transition-colors hover:bg-accent active:bg-accent";

export function SettingsLink({
  to,
  params,
  ...rest
}: {
  to: string;
  params?: Record<string, string>;
  icon: LucideIcon;
  tone: Tone;
  title: string;
  description?: string;
  value?: string;
}) {
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Link to={to as any} params={params as any} className={ROW}>
      <Body {...rest} />
    </Link>
  );
}

export function SettingsButton({
  onClick,
  ...rest
}: {
  onClick: () => void;
  icon: LucideIcon;
  tone: Tone;
  title: string;
  description?: string;
  value?: string;
}) {
  return (
    <Button type="button" variant="ghost" onClick={onClick} className={ROW}>
      <Body {...rest} />
    </Button>
  );
}
