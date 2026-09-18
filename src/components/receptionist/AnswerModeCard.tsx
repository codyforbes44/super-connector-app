import { useQuery } from "@tanstack/react-query";
import { Bot, Loader2, Play, Sparkles, Voicemail } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { agentsQuery } from "@/components/receptionist/AgentList";
import { useVoices } from "@/components/receptionist/VoiceLibrary";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/format";
import {
  previewVoice,
  renderGreeting,
  saveVoiceAssistant,
} from "@/lib/elevenlabs.functions";

export type AnswerModeNumber = {
  sid: string;
  phone_number?: string;
  answer_mode?: string | null;
  elevenlabs_voice_id?: string | null;
  elevenlabs_agent_id?: string | null;
  voicemail_greeting?: string | null;
};

export type AnswerMode = "classic" | "ai_greeting" | "ai_agent";

const MODES: Array<{ value: AnswerMode; label: string; hint: string; icon: typeof Bot }> = [
  {
    value: "ai_agent",
    label: "AI receptionist answers",
    hint: "Picks up and talks with the caller, books work and writes it all down for you.",
    icon: Bot,
  },
  {
    value: "ai_greeting",
    label: "AI greets, then voicemail",
    hint: "A lifelike greeting in your words, then the caller leaves a message.",
    icon: Sparkles,
  },
  {
    value: "classic",
    label: "Rings you, then voicemail",
    hint: "Your phone rings first; if you can't grab it, they leave a message.",
    icon: Voicemail,
  },
];

export function AnswerModeCard({
  number,
  canEdit,
  onChanged,
}: {
  number: AnswerModeNumber;
  canEdit: boolean;
  onChanged: () => Promise<unknown>;
}) {
  const voices = useVoices();
  const agents = useQuery(agentsQuery);

  const [mode, setMode] = useState<AnswerMode>(
    (["classic", "ai_greeting", "ai_agent"] as const).includes(number.answer_mode as AnswerMode)
      ? (number.answer_mode as AnswerMode)
      : "classic",
  );
  const [voiceId, setVoiceId] = useState(number.elevenlabs_voice_id ?? "");
  const [agentId, setAgentId] = useState(number.elevenlabs_agent_id ?? "");
  const [greeting, setGreeting] = useState(number.voicemail_greeting ?? "");
  const [busy, setBusy] = useState<"save" | "render" | "preview" | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => audioRef.current?.pause(), []);

  function play(dataUrl: string) {
    audioRef.current?.pause();
    const audio = new Audio(dataUrl);
    audioRef.current = audio;
    void audio.play();
  }

  async function doPreview() {
    if (!voiceId) {
      toast.error("Pick a voice first.");
      return;
    }
    setBusy("preview");
    try {
      const result = await previewVoice({ data: { voiceId, text: greeting } });
      play(result.dataUrl);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function doRender() {
    if (!voiceId) {
      toast.error("Pick a voice first.");
      return;
    }
    setBusy("render");
    try {
      const result = await renderGreeting({ data: { sid: number.sid, text: greeting, voiceId } });
      play(result.dataUrl);
      await onChanged();
      toast.success("Greeting recorded in that voice.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  const allowedAgents = agents.data ?? [];
  // Only allowlisted SixVox agents ever reach this list (server-side filter).
  const agentPicked = allowedAgents.some((a) => a.agent_id === agentId);
  const needsAgent = mode === "ai_agent" && !agentPicked;

  async function save() {
    if (needsAgent) {
      toast.error("Pick a SixVox agent before saving.");
      return;
    }
    setBusy("save");
    try {
      await saveVoiceAssistant({
        data: {
          sid: number.sid,
          answerMode: mode,
          voiceId: voiceId || null,
          agentId: agentId || null,
        },
      });
      await onChanged();
      toast.success("Answering mode saved.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {MODES.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              disabled={!canEdit}
              onClick={() => setMode(option.value)}
              className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left text-xs transition disabled:opacity-60 ${
                mode === option.value
                  ? "key-raised text-foreground"
                  : "bg-muted/30 text-muted-foreground"
              }`}
            >
              <Icon className="mt-0.5 size-4 text-primary" />
              <span>
                <span className="block font-semibold">{option.label}</span>
                <span className="opacity-70">{option.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-1.5">
        <Label>AI voice</Label>
        <Select value={voiceId} onValueChange={setVoiceId} disabled={!canEdit}>
          <SelectTrigger className="h-11 w-full rounded-xl px-4">
            <SelectValue placeholder={voices.isLoading ? "Loading voices…" : "Pick a voice"} />
          </SelectTrigger>
          <SelectContent>
            {(voices.data ?? []).map((v) => (
              <SelectItem key={v.voice_id} value={v.voice_id}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {voices.isError ? (
          <p className="text-xs text-destructive">{errorMessage(voices.error)}</p>
        ) : null}
      </div>

      {mode === "ai_agent" ? (
        <div className="space-y-1.5">
          <Label>Conversational agent</Label>
          <Select value={agentId} onValueChange={setAgentId} disabled={!canEdit}>
            <SelectTrigger className="h-11 w-full rounded-xl px-4">
              <SelectValue placeholder={agents.isLoading ? "Loading agents…" : "Pick an agent"} />
            </SelectTrigger>
            <SelectContent>
              {allowedAgents.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  No SixVox agents configured — contact admin.
                </div>
              ) : null}
              {allowedAgents.map((a) => (
                <SelectItem key={a.agent_id} value={a.agent_id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {needsAgent && !agents.isLoading ? (
            <p className="text-xs font-medium text-destructive">
              Pick a SixVox agent — this number won't answer with AI until you do.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Callers talk to this agent live. Transcripts and summaries land on the call record.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label>Greeting script</Label>
          <Textarea
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            maxLength={900}
            rows={3}
            disabled={!canEdit}
            className="rounded-2xl"
            placeholder="Thanks for calling — leave a message and we'll call you right back."
          />
          <div className="flex gap-2 pt-1">
            <Button
              variant="secondary"
              className="h-10 flex-1 rounded-xl"
              onClick={doPreview}
              disabled={busy !== null}
            >
              {busy === "preview" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              Preview
            </Button>
            {canEdit ? (
              <Button
                variant="secondary"
                className="h-10 flex-1 rounded-xl"
                onClick={doRender}
                disabled={busy !== null}
              >
                {busy === "render" ? <Loader2 className="size-4 animate-spin" /> : null}
                Use this greeting
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {canEdit ? (
        <Button
          className="key-signal h-11 w-full rounded-xl font-semibold"
          onClick={save}
          disabled={busy !== null || needsAgent}
        >
          {busy === "save" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          {needsAgent ? "Pick a SixVox agent" : "Save answering mode"}
        </Button>
      ) : null}
    </div>
  );
}