import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type CallFilterState = {
  q: string;
  direction: "all" | "inbound" | "outbound";
  range: "all" | "today" | "7d" | "30d";
  device: "all" | "app" | "phone";
};

const GROUPS: { key: keyof Omit<CallFilterState, "q">; options: { value: string; label: string }[] }[] = [
  {
    key: "direction",
    options: [
      { value: "all", label: "All calls" },
      { value: "inbound", label: "Inbound" },
      { value: "outbound", label: "Outbound" },
    ],
  },
  {
    key: "range",
    options: [
      { value: "all", label: "Any time" },
      { value: "today", label: "Today" },
      { value: "7d", label: "7 days" },
      { value: "30d", label: "30 days" },
    ],
  },
  {
    key: "device",
    options: [
      { value: "all", label: "Any device" },
      { value: "app", label: "In-app" },
      { value: "phone", label: "Phone" },
    ],
  },
];

export function CallFilters({
  value,
  onChange,
}: {
  value: CallFilterState;
  onChange: (patch: Partial<CallFilterState>) => void;
}) {
  const dirty =
    value.q !== "" || value.direction !== "all" || value.range !== "all" || value.device !== "all";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-2.5 px-4 pb-3 lg:max-w-4xl">
      <div className="relative">
        <Search className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value.q}
          onChange={(event) => onChange({ q: event.target.value })}
          placeholder="Search number, status, call SID, agent"
          className="h-11 rounded-xl pl-11"
          aria-label="Search call history"
        />
      </div>

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {GROUPS.flatMap((group) =>
          group.options
            .filter((option) => option.value !== "all" || value[group.key] === "all")
            .map((option) => {
              const active = value[group.key] === option.value;
              return (
                <button
                  key={`${group.key}-${option.value}`}
                  type="button"
                  onClick={() =>
                    onChange({
                      [group.key]: active ? "all" : option.value,
                    } as Partial<CallFilterState>)
                  }
                  className={cn(
                    "shrink-0 rounded-full px-3.5 py-1.5 text-[0.72rem] font-medium whitespace-nowrap transition",
                    active && option.value !== "all"
                      ? "key-signal text-primary-foreground"
                      : "glass-panel text-muted-foreground",
                  )}
                >
                  {option.label}
                </button>
              );
            }),
        )}
        {dirty ? (
          <button
            type="button"
            onClick={() => onChange({ q: "", direction: "all", range: "all", device: "all" })}
            className="glass-panel flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[0.72rem] text-muted-foreground"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}