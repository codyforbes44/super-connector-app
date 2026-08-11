import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type Tone = "cyan" | "green" | "violet" | "amber";

const TONE: Record<Tone, string> = {
  cyan: "bg-primary/18 text-primary",
  green: "bg-success/18 text-success",
  violet: "bg-violet/18 text-violet",
  amber: "bg-warning/18 text-warning",
};

/** Rotating tone so a list of tiles reads colourful without being assigned by hand. */
export const TONES: Tone[] = ["cyan", "green", "violet", "amber"];

export function IconTile({
  icon: Icon,
  tone = "cyan",
  className,
}: {
  icon: LucideIcon;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-2xl",
        TONE[tone],
        className,
      )}
    >
      <Icon className="size-[1.1rem]" aria-hidden />
    </span>
  );
}

/** A flat, hairline-divided block of rows — the app's list language on the web. */
export function FeatureGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "glass-panel divide-y divide-border/60 overflow-hidden rounded-3xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function FeatureRow({
  icon,
  tone,
  title,
  body,
  trailing,
}: {
  icon: LucideIcon;
  tone?: Tone;
  title: string;
  body?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5 sm:px-5 sm:py-4">
      <IconTile icon={icon} tone={tone ?? "cyan"} />
      <div className="min-w-0 flex-1">
        <p className="text-[0.95rem] font-medium">{title}</p>
        {body ? (
          <p className="mt-1 text-[0.82rem] leading-relaxed text-muted-foreground text-pretty">
            {body}
          </p>
        ) : null}
      </div>
      {trailing ? <div className="shrink-0 pt-0.5">{trailing}</div> : null}
    </div>
  );
}