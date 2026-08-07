import { Delete } from "lucide-react";

const KEYS = [
  { digit: "1", letters: "" },
  { digit: "2", letters: "ABC" },
  { digit: "3", letters: "DEF" },
  { digit: "4", letters: "GHI" },
  { digit: "5", letters: "JKL" },
  { digit: "6", letters: "MNO" },
  { digit: "7", letters: "PQRS" },
  { digit: "8", letters: "TUV" },
  { digit: "9", letters: "WXYZ" },
  { digit: "*", letters: "" },
  { digit: "0", letters: "+" },
  { digit: "#", letters: "" },
] as const;

export function Dialpad({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex min-h-14 items-center justify-center gap-2">
        <p className="tabular font-display truncate text-3xl font-semibold tracking-tight">
          {value || <span className="text-muted-foreground/50">Enter a number</span>}
        </p>
        {value ? (
          <button
            type="button"
            onClick={() => onChange(value.slice(0, -1))}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors active:text-foreground"
          >
            <Delete className="h-5 w-5" />
            <span className="sr-only">Delete last digit</span>
          </button>
        ) : null}
      </div>

      <div className="mx-auto grid max-w-[17rem] grid-cols-3 gap-3">
        {KEYS.map((key) => (
          <button
            key={key.digit}
            type="button"
            onClick={() => onChange((value + key.digit).slice(0, 20))}
            className="key-raised mx-auto flex h-16 w-16 flex-col items-center justify-center rounded-full"
          >
            <span className="font-display text-xl leading-none font-semibold">{key.digit}</span>
            {key.letters ? (
              <span className="mt-0.5 text-[0.55rem] tracking-[0.12em] text-muted-foreground">
                {key.letters}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}