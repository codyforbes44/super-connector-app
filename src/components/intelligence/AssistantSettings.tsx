import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/format";
import { getAssistantSettings, saveAssistantSettings } from "@/lib/intelligence.functions";

/**
 * Call intelligence controls: what the assistant is told, whether calls are
 * transcribed at all (off by default, with a spoken announcement), and digests.
 */
export function AssistantSettings() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["assistant-settings"], queryFn: () => getAssistantSettings() });
  const [instructions, setInstructions] = useState("");

  useEffect(() => {
    if (settings.data) setInstructions(settings.data.assistantInstructions);
  }, [settings.data]);

  async function save(patch: Parameters<typeof saveAssistantSettings>[0]["data"], message: string) {
    try {
      await saveAssistantSettings({ data: patch });
      await qc.invalidateQueries({ queryKey: ["assistant-settings"] });
      toast.success(message);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <section className="space-y-3 border-t border-border px-4 py-4">
      <h2 className="font-display text-sm font-semibold">Assistant & call notes</h2>

      <div className="glass-panel flex items-start gap-3 rounded-2xl px-3.5 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Transcribe my calls</p>
          <p className="text-[0.7rem] text-muted-foreground">
            Off by default. When on, SixVox says the call is being transcribed before it connects,
            then writes a summary and follow-ups for you. Voicemails and calls your assistant
            answers are always summarised.
          </p>
        </div>
        <Switch
          checked={Boolean(settings.data?.transcribeCalls)}
          onCheckedChange={(value) =>
            void save(
              { transcribeCalls: value },
              value ? "Calls will be transcribed." : "Call transcription is off.",
            )
          }
        />
      </div>

      <div className="glass-panel flex items-start gap-3 rounded-2xl px-3.5 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Daily digest</p>
          <p className="text-[0.7rem] text-muted-foreground">
            One summary of who called, what they wanted and what still needs a reply.
          </p>
        </div>
        <Switch
          checked={Boolean(settings.data?.digestEnabled)}
          onCheckedChange={(value) =>
            void save({ digestEnabled: value }, value ? "Digest on." : "Digest off.")
          }
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="assistant-instructions">How your assistant should handle calls</Label>
        <Textarea
          id="assistant-instructions"
          rows={4}
          maxLength={2000}
          placeholder="Book appointments Tuesday to Thursday, 9 to 4. Quote $150 minimum. Anything urgent, ring my cell."
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          className="rounded-2xl"
        />
        <p className="text-[0.7rem] text-muted-foreground">
          Plain English. Used when the assistant answers and when it writes your summaries.
        </p>
      </div>
      <Button
        className="key-signal h-11 w-full rounded-xl sm:w-auto sm:px-8"
        onClick={() => void save({ assistantInstructions: instructions }, "Instructions saved.")}
      >
        Save instructions
      </Button>
    </section>
  );
}