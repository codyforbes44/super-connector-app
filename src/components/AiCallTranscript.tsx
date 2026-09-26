import { useQuery } from "@tanstack/react-query";
import { Bot } from "lucide-react";

import { getCallConversation } from "@/lib/elevenlabs.functions";

type Turn = { role?: string; message?: string };

export function AiCallTranscript({ callSid }: { callSid: string }) {
  const { data } = useQuery({
    queryKey: ["ai-conversation", callSid],
    queryFn: () => getCallConversation({ data: { callSid } }),
  });

  if (!data) return null;
  const turns = ((data.transcript as Turn[] | null) ?? []).filter((t) => t.message);

  return (
    <div className="glass-panel mt-2 space-y-2 rounded-2xl p-3.5">
      <div className="flex items-center gap-2">
        <Bot className="size-4 text-primary" />
        <p className="font-display text-sm font-semibold">AI assistant</p>
      </div>
      {data.summary ? <p className="text-sm text-muted-foreground">{data.summary}</p> : null}
      {turns.length ? (
        <ul className="max-h-56 space-y-1.5 overflow-y-auto text-sm">
          {turns.map((turn, index) => (
            <li key={index}>
              <span className="text-[0.7rem] tracking-wide text-muted-foreground uppercase">
                {turn.role === "agent" ? "Assistant" : "Caller"}
              </span>
              <p className="break-words">{turn.message}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
