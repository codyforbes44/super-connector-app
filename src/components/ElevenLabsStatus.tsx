import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";

import { elevenLabsStatus } from "@/lib/elevenlabs.functions";

export function ElevenLabsStatus() {
  const { data } = useQuery({ queryKey: ["el-status"], queryFn: () => elevenLabsStatus() });

  const used = data?.characterCount ?? null;
  const limit = data?.characterLimit ?? null;

  return (
    <section className="space-y-3 border-t border-border px-4 py-4">
      <h2 className="font-display text-sm font-semibold">AI voice</h2>
      <div className="glass-panel flex items-center gap-3 rounded-3xl px-4 py-3">
        <span
          className={
            data?.connected
              ? "h-2.5 w-2.5 shrink-0 rounded-full bg-success"
              : "h-2.5 w-2.5 shrink-0 rounded-full bg-destructive"
          }
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {data?.connected ? `Connected${data.tier ? ` · ${data.tier}` : ""}` : "Not connected"}
          </p>
          <p className="truncate text-[0.7rem] text-muted-foreground">
            {data?.error
              ? data.error
              : used !== null && limit !== null
                ? `${used.toLocaleString()} / ${limit.toLocaleString()} characters used`
                : "Voices and conversational agents for voicemail"}
          </p>
        </div>
        <Sparkles className="size-4 text-primary" />
      </div>
      <p className="text-[0.7rem] text-muted-foreground">
        Set answering mode per number under Numbers. For live AI assistants, point your AI
        receptionist agent's post-call webhook at{" "}
        <span className="break-all">/api/public/elevenlabs/post-call</span> on this app to store
        transcripts and summaries.
      </p>
    </section>
  );
}
