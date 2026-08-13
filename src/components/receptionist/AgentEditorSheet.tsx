import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useVoices } from "@/components/receptionist/VoiceLibrary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/format";
import {
  createElevenLabsAgent,
  getElevenLabsAgent,
  updateElevenLabsAgent,
} from "@/lib/elevenlabs.functions";

export const AGENT_LANGUAGES = [
  ["en", "English"],
  ["es", "Spanish"],
  ["fr", "French"],
  ["de", "German"],
  ["pt", "Portuguese"],
  ["it", "Italian"],
  ["nl", "Dutch"],
  ["hi", "Hindi"],
  ["ja", "Japanese"],
] as const;

const PRESETS = [
  {
    label: "Receptionist",
    prompt:
      "You are the virtual receptionist for our business. Greet the caller, find out who they are and why they're calling, answer basic questions about hours and location, and take a detailed message with a callback number.",
    first: "Hi, thanks for calling — how can I help you today?",
  },
  {
    label: "Lead intake",
    prompt:
      "You qualify inbound leads. Collect the caller's name, company, budget range, timeline and the best callback number. Be efficient and never promise pricing.",
    first: "Hi there — I can get some quick details and have the right person call you back.",
  },
  {
    label: "Support triage",
    prompt:
      "You triage support calls. Identify the product, the problem and its urgency, capture the account email, and tell the caller a specialist will follow up.",
    first: "Thanks for calling support — can you tell me what's going wrong?",
  },
];

export function AgentEditorSheet({
  agentId,
  duplicateOf,
  onClose,
  onSaved,
}: {
  /** Existing agent id to edit, or null for a new agent. */
  agentId: string | null;
  duplicateOf?: string | null;
  onClose: () => void;
  onSaved: (agentId: string) => Promise<unknown> | void;
}) {
  const sourceId = agentId ?? duplicateOf ?? null;
  const voices = useVoices();
  const detail = useQuery({
    queryKey: ["el-agent", sourceId],
    queryFn: () => getElevenLabsAgent({ data: { agentId: sourceId as string } }),
    enabled: Boolean(sourceId),
  });

  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [language, setLanguage] = useState("en");
  const [voiceId, setVoiceId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const data = detail.data;
    if (!data) return;
    setName(duplicateOf ? `${data.name} copy` : data.name);
    setPrompt(data.prompt);
    setFirstMessage(data.firstMessage);
    setLanguage(data.language || "en");
    setVoiceId(data.voiceId ?? "");
  }, [detail.data, duplicateOf]);

  async function save() {
    setSaving(true);
    try {
      const draft = { name, prompt, firstMessage, language, voiceId: voiceId || null };
      if (agentId) {
        await updateElevenLabsAgent({ data: { ...draft, agentId } });
        await onSaved(agentId);
      } else {
        const result = await createElevenLabsAgent({ data: draft });
        await onSaved(result.agent_id);
      }
      toast.success(agentId ? "Agent updated." : "Agent created.");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="app-gradient max-h-[90dvh] overflow-y-auto rounded-t-[2rem] border-border"
      >
        <SheetHeader className="px-0">
          <SheetTitle className="font-display">
            {agentId ? "Edit agent" : duplicateOf ? "Duplicate agent" : "New agent"}
          </SheetTitle>
        </SheetHeader>

        {detail.isLoading ? (
          <div className="grid place-items-center py-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 pb-[env(safe-area-inset-bottom)]">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder="Front desk"
                className="h-11 rounded-xl px-4"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setPrompt(preset.prompt);
                    setFirstMessage(preset.first);
                  }}
                  className="rounded-full bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label>Prompt</Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                maxLength={8000}
                className="rounded-2xl"
                placeholder="Describe who the agent is, what it should ask, and what it must never say."
              />
            </div>

            <div className="space-y-1.5">
              <Label>First message</Label>
              <Textarea
                value={firstMessage}
                onChange={(e) => setFirstMessage(e.target.value)}
                rows={2}
                maxLength={400}
                className="rounded-2xl"
                placeholder="Hi, thanks for calling — how can I help?"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Voice</Label>
              <Select value={voiceId} onValueChange={setVoiceId}>
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
            </div>

            <div className="space-y-1.5">
              <Label>Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="h-11 w-full rounded-xl px-4">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGENT_LANGUAGES.map(([code, label]) => (
                    <SelectItem key={code} value={code}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              className="key-signal h-12 w-full rounded-xl font-semibold"
              onClick={save}
              disabled={saving}
            >
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {agentId ? "Save agent" : "Create agent"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}