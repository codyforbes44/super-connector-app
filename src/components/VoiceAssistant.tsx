import { Link } from "@tanstack/react-router";
import { ChevronRight, Sparkles } from "lucide-react";

import { AnswerModeCard, type AnswerModeNumber } from "@/components/receptionist/AnswerModeCard";

export type VoiceAssistantNumber = AnswerModeNumber;

export function VoiceAssistant({
  number,
  canEdit = true,
  onChanged,
}: {
  number: VoiceAssistantNumber;
  canEdit?: boolean;
  onChanged: () => Promise<unknown>;
}) {
  return (
    <div className="glass-panel space-y-4 rounded-3xl p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <p className="font-display text-sm font-semibold">AI answering</p>
        </div>
        <Link
          to="/receptionist"
          className="flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
        >
          Receptionist hub
          <ChevronRight className="size-3.5" />
        </Link>
      </div>

      <AnswerModeCard
        number={number}
        canEdit={canEdit}
        onChanged={onChanged}
        showLanguage={false}
      />
    </div>
  );
}
