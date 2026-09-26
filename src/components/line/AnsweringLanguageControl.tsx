import type { LineLanguage } from "@/lib/answering/language";

const OPTIONS: Array<{ value: LineLanguage; label: string }> = [
  { value: "en", label: "English only" },
  { value: "es", label: "Spanish only" },
  {
    value: "auto",
    label: "Auto-detect (Spanish when the caller speaks Spanish)",
  },
];

export function AnsweringLanguageControl({
  value,
  onChange,
  disabled,
}: {
  value: LineLanguage;
  onChange: (language: LineLanguage) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2" data-testid="answering-language">
      <div>
        <h3 className="font-display text-sm font-semibold">Answering language</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Booking texts follow this. A missed-call text you already wrote is kept. The default
          missed-call text switches to Spanish for a Spanish line, or for auto when that caller
          already spoke Spanish.
        </p>
      </div>
      <div className="space-y-2" role="radiogroup" aria-label="Answering language">
        {OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              data-testid={`answering-language-${option.value}`}
              onClick={() => onChange(option.value)}
              className={`w-full rounded-2xl p-3 text-left text-xs transition disabled:opacity-60 ${
                selected ? "key-raised text-foreground" : "bg-muted/30 text-muted-foreground"
              }`}
            >
              <span className="block font-semibold">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
