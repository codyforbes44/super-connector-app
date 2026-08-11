import { useState } from "react";

type Turn = { speaker?: string; text?: string; at?: number };

function label(speaker?: string): string {
  if (speaker === "assistant") return "Assistant";
  if (speaker === "you") return "You";
  return "Caller";
}

export function TranscriptView({ turns }: { turns: Turn[] }) {
  const [open, setOpen] = useState(false);
  const usable = turns.filter((turn) => (turn.text ?? "").trim());
  if (!usable.length) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="text-xs font-semibold text-primary"
      >
        {open ? "Hide transcript" : `Read transcript (${usable.length} turns)`}
      </button>
      {open ? (
        <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1 text-sm">
          {usable.map((turn, index) => (
            <li key={index}>
              <span className="text-[0.65rem] tracking-wide text-muted-foreground uppercase">
                {label(turn.speaker)}
              </span>
              <p className="break-words">{turn.text}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}