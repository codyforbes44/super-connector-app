import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bot, ChevronRight, Loader2, Play, SlidersHorizontal, Sparkles, Voicemail } from "lucide-react";
import { toast } from "sonner";

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
import {
  listElevenLabsAgents,
  listElevenLabsVoices,
  previewVoice,
  renderGreeting,
  saveVoiceAssistant,
} from "@/lib/elevenlabs.functions";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export type VoiceAssistantNumber = {
  sid: string;
  answer_mode?: string | null;
  elevenlabs_voice_id?: string | null;
  elevenlabs_agent_id?: string | null;
  voicemail_greeting?: string | null;
};

export function VoiceAssistant({
  number,
  onChanged,
}: {
  number: VoiceAssistantNumber;
  onChanged: () => Promise<unknown>;
}) {
  const [mode, setMode] = useState<"classic" | "ai_agent">(
    number.answer_mode === "ai_agent" ? "ai_agent" : "classic",
  );
  const [voiceId, setVoiceId] = useState(number.elevenlabs_voice_id ?? "");
  const [agentId, setAgentId] = useState(number.elevenlabs_agent_id ?? "");
  const [greeting, setGreeting] = useState(number.voicemail_greeting ?? "");
  const [busy, setBusy] = useState<"save" | "render" | "preview" | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => audioRef.current?.pause(), []);

  const voices = useQuery({ queryKey: ["el-voices"], queryFn: () => listElevenLabsVoices() });
  const agents = useQuery({ queryKey: ["el-agents"], queryFn: () => listElevenLabsAgents() });

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

  async function save() {
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
    <div className="glass-panel space-y-4 rounded-3xl p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <p className="font-display text-sm font-semibold">AI answering</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMode("classic")}
          className={`flex flex-col items-start gap-1 rounded-2xl p-3 text-left text-xs transition ${
            mode === "classic" ? "key-raised text-foreground" : "bg-muted/30 text-muted-foreground"
          }`}
        >
          <Voicemail className="size-4" />
          <span className="font-semibold">Classic voicemail</span>
          <span className="opacity-70">Lifelike greeting, then record</span>
        </button>
        <button
          type="button"
          onClick={() => setMode("ai_agent")}
          className={`flex flex-col items-start gap-1 rounded-2xl p-3 text-left text-xs transition ${
            mode === "ai_agent" ? "key-raised text-foreground" : "bg-muted/30 text-muted-foreground"
          }`}
        >
          <Bot className="size-4" />
          <span className="font-semibold">AI assistant</span>
          <span className="opacity-70">Live two-way conversation</span>
        </button>
      </div>

      <div className="space-y-1.5">
        <Label>ElevenLabs voice</Label>
        <Select value={voiceId} onValueChange={setVoiceId}>
          <SelectTrigger className="h-11 w-full rounded-full px-4">
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
          <Select value={agentId} onValueChange={setAgentId}>
            <SelectTrigger className="h-11 w-full rounded-full px-4">
              <SelectValue placeholder={agents.isLoading ? "Loading agents…" : "Pick an agent"} />
            </SelectTrigger>
            <SelectContent>
              {(agents.data ?? []).map((a) => (
                <SelectItem key={a.agent_id} value={a.agent_id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Callers talk to this agent live. Transcripts and summaries land on the call record.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label>Greeting script</Label>
          <Textarea
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            maxLength={900}
            rows={3}
            className="rounded-2xl"
            placeholder="Thanks for calling — leave a message and we'll call you right back."
          />
          <div className="flex gap-2 pt-1">
            <Button
              variant="secondary"
              className="h-10 flex-1 rounded-full"
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
            <Button
              variant="secondary"
              className="h-10 flex-1 rounded-full"
              onClick={doRender}
              disabled={busy !== null}
            >
              {busy === "render" ? <Loader2 className="size-4 animate-spin" /> : null}
              Use this greeting
            </Button>
          </div>
        </div>
      )}

      <Button
        className="key-signal h-11 w-full rounded-full font-semibold"
        onClick={save}
        disabled={busy !== null}
      >
        {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : null}
        Save answering mode
      </Button>

      <Link
        to="/assistant/$sid"
        params={{ sid: number.sid }}
        className="flex items-center gap-3 rounded-2xl bg-muted/30 px-4 py-3 text-xs text-muted-foreground transition hover:text-foreground"
      >
        <SlidersHorizontal className="size-4 text-primary" />
        <span className="flex-1 text-left">
          <span className="block font-semibold text-foreground">Assistant behaviour</span>
          Prompt, tone, language and fallback
        </span>
        <ChevronRight className="size-4" />
      </Link>
    </div>
  );
}