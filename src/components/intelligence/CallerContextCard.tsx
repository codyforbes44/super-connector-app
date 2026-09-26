import { useQuery } from "@tanstack/react-query";
import { History, Star } from "lucide-react";

import { getContactMemory } from "@/lib/intelligence.functions";

/**
 * What happened last time this number called. Shown on the incoming-call
 * screen and on a call's details so the user answers with context.
 */
export function CallerContextCard({
  contactNumber,
  compact,
}: {
  contactNumber: string;
  compact?: boolean;
}) {
  const { data } = useQuery({
    queryKey: ["contact-memory", contactNumber],
    queryFn: () => getContactMemory({ data: { contactNumber } }),
    enabled: Boolean(contactNumber),
    staleTime: 60_000,
  });

  const lines = ((data?.memory?.rolling_summary as string | null) ?? "")
    .split("\n")
    .filter(Boolean)
    .slice(-3)
    .reverse();
  if (!lines.length && !data?.rule) return null;

  return (
    <div
      className={
        compact ? "glass-panel w-full rounded-2xl p-3" : "glass-panel mt-2 rounded-2xl p-3.5"
      }
    >
      <div className="flex items-center gap-2">
        {data?.rule?.behavior === "vip" ? (
          <Star className="size-4 shrink-0 text-primary" />
        ) : (
          <History className="size-4 shrink-0 text-primary" />
        )}
        <p className="font-display text-sm font-semibold">
          {data?.rule?.label ||
            (data?.rule?.behavior === "vip" ? "VIP caller" : "You've spoken before")}
        </p>
        {data?.memory?.call_count ? (
          <span className="ml-auto text-[0.7rem] text-muted-foreground">
            {data.memory.call_count} call{data.memory.call_count === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>
      <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
        {lines.map((line) => (
          <li key={line} className="break-words">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
