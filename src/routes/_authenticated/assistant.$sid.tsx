import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, Bot, Loader2, PhoneForwarded, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, formatPhone } from "@/lib/format";
import {
  getAssistantProfile,
  listElevenLabsAgents,
  saveAssistantProfile,
} from "@/lib/elevenlabs.functions";

export const Route = createFileRoute("/_authenticated/assistant/$sid")({
  head: () => ({
    meta: [
      { title: "AI assistant setup — SixVox" },
      {
        name: "description",
        content:
          "Tune the AI voicemail assistant prompt, tone and fallback behaviour for a phone number.",
      },
      { property: "og:title", content: "AI assistant setup — SixVox" },
      {
        property: "og:description",
        content:
          "Tune the AI voicemail assistant prompt, tone and fallback behaviour for a phone number.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssistantConfigScreen,
});

const TONES = [
  { value: "professional", label: "Professional", hint: "Polished and efficient" },
  { value: "friendly", label: "Friendly", hint: "Warm and upbeat" },
  { value: "concise", label: "Concise", hint: "Short, direct replies" },
  { value: "empathetic", label: "Empathetic", hint: "Calm and reassuring" },
  { value: "playful", label: "Playful", hint: "Light and casual" },
];

const LANGUAGES = [
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

const PROMPT_PRESETS = [
  {
    label: "Receptionist",
    text: "You are the virtual receptionist for our business. Greet the caller, find out who they are and why they're calling, answer basic questions about hours and location, and take a detailed message with a callback number.",
  },
  {
    label: "Lead intake",
    text: "You qualify inbound leads. Collect the caller's name, company, budget range, timeline and the best callback number. Be efficient and never promise pricing.",
  },
  {
    label: "Support triage",
    text: "You triage support calls. Identify the product, the problem and its urgency, capture the account email, and tell the caller a specialist will follow up.",
  },
];

function AssistantConfigScreen() {
  const { sid } = useParams({ from: "/_authenticated/assistant/$sid" });
  const queryClient = useQueryClient();

  const numberQuery = useQuery({
    queryKey: ["assistant-profile", sid],
    queryFn: () => getAssistantProfile({ data: { sid } }),
  });
  const agents = useQuery({ queryKey: ["el-agents"], queryFn: () => listElevenLabsAgents() });

  const [prompt, setPrompt] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [tone, setTone] = useState("professional");
  const [language, setLanguage] = useState("en");
  const [fallback, setFallback] = useState<"voicemail" | "forward" | "hangup">("voicemail");
  const [fallbackNumber, setFallbackNumber] = useState("");
  const [maxDuration, setMaxDuration] = useState("300");
  const [saving, setSaving] = useState(false);

  const row = numberQuery.data as Record<string, unknown> | undefined;

  useEffect(() => {
    if (!row) return;
    setPrompt((row["ai_prompt"] as string) ?? "");
    setFirstMessage((row["ai_first_message"] as string) ?? "");
    setTone((row["ai_tone"] as string) ?? "professional");
    setLanguage((row["ai_language"] as string) ?? "en");
    setFallback(((row["ai_fallback"] as string) ?? "voicemail") as typeof fallback);
    setFallbackNumber((row["ai_fallback_number"] as string) ?? "");
    setMaxDuration(String((row["ai_max_duration"] as number) ?? 300));
  }, [row]);

  async function save() {
    setSaving(true);
    try {
      await saveAssistantProfile({
        data: {
          sid,
          prompt: prompt || null,
          firstMessage: firstMessage || null,
          tone,
          language,
          fallback,
          fallbackNumber: fallbackNumber || null,
          maxDuration: Number(maxDuration) || 300,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["assistant-profile", sid] });
      await queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      toast.success("Assistant settings saved.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const agentName = (agents.data ?? []).find(
    (a) => a.agent_id === (row?.["elevenlabs_agent_id"] as string),
  )?.name;
  const aiOn = row?.["answer_mode"] === "ai_agent";

  return (
    <div className="pb-8">
      <header className="flex items-center gap-3 px-4 pb-3 pt-4">
        <Link to="/numbers" className="key-raised grid size-10 place-items-center rounded-full">
          <ArrowLeft className="size-4" />
          <span className="sr-only">Back to numbers</span>
        </Link>
        <div>
          <h1 className="font-display tabular text-lg font-semibold">
            {row ? formatPhone(row["phone_number"] as string) : "Assistant"}
          </h1>
          <p className="text-xs text-muted-foreground">AI assistant behaviour</p>
        </div>
      </header>

      {numberQuery.isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : numberQuery.isError ? (
        <p className="px-4 text-sm text-destructive">{errorMessage(numberQuery.error)}</p>
      ) : (
        <div className="space-y-4 px-4">
          <div className="glass-panel flex items-center gap-3 rounded-3xl p-4">
            <Bot className="size-5 text-primary" />
            <div className="text-xs">
              <p className="font-semibold">
                {aiOn ? "AI assistant is answering" : "AI assistant is off"}
              </p>
              <p className="text-muted-foreground">
                {aiOn
                  ? `Agent: ${agentName ?? (row?.["elevenlabs_agent_id"] as string) ?? "none"}`
                  : "Turn it on from the number's answering mode card."}
              </p>
            </div>
          </div>

          <section className="glass-panel space-y-3 rounded-3xl p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <p className="font-display text-sm font-semibold">Prompt</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {PROMPT_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setPrompt(preset.text)}
                  className="rounded-full bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              maxLength={4000}
              className="rounded-2xl"
              placeholder="Describe who the assistant is, what it should ask, and what it must never say."
            />
            <p className="text-right text-[11px] text-muted-foreground">{prompt.length}/4000</p>

            <div className="space-y-1.5">
              <Label>Opening line</Label>
              <Textarea
                value={firstMessage}
                onChange={(e) => setFirstMessage(e.target.value)}
                rows={2}
                maxLength={400}
                className="rounded-2xl"
                placeholder="Hi, thanks for calling SixVox — how can I help?"
              />
            </div>
          </section>

          <section className="glass-panel space-y-3 rounded-3xl p-4">
            <p className="font-display text-sm font-semibold">Tone & language</p>
            <div className="grid grid-cols-2 gap-2">
              {TONES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTone(t.value)}
                  className={`flex flex-col items-start gap-0.5 rounded-2xl p-3 text-left text-xs transition ${
                    tone === t.value
                      ? "key-raised text-foreground"
                      : "bg-muted/30 text-muted-foreground"
                  }`}
                >
                  <span className="font-semibold">{t.label}</span>
                  <span className="opacity-70">{t.hint}</span>
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label>Spoken language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="h-11 w-full rounded-xl px-4">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map(([code, label]) => (
                    <SelectItem key={code} value={code}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          <section className="glass-panel space-y-3 rounded-3xl p-4">
            <div className="flex items-center gap-2">
              <PhoneForwarded className="size-4 text-primary" />
              <p className="font-display text-sm font-semibold">Fallback behaviour</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Used when the assistant can't take the call — no AI connection, or the agent fails to
              start.
            </p>
            <div className="space-y-2">
              {(
                [
                  ["voicemail", "Classic voicemail", "Play the greeting and record a message"],
                  ["forward", "Forward the call", "Ring another number instead"],
                  ["hangup", "Polite hang up", "Apologise and end the call"],
                ] as const
              ).map(([value, label, hint]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFallback(value)}
                  className={`flex w-full flex-col items-start gap-0.5 rounded-2xl p-3 text-left text-xs transition ${
                    fallback === value
                      ? "key-raised text-foreground"
                      : "bg-muted/30 text-muted-foreground"
                  }`}
                >
                  <span className="font-semibold">{label}</span>
                  <span className="opacity-70">{hint}</span>
                </button>
              ))}
            </div>
            {fallback === "forward" ? (
              <div className="space-y-1.5">
                <Label>Fallback number</Label>
                <Input
                  value={fallbackNumber}
                  onChange={(e) => setFallbackNumber(e.target.value)}
                  placeholder="+15551234567"
                  inputMode="tel"
                  maxLength={20}
                  className="h-11 rounded-xl px-4"
                />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label>Max conversation length (seconds)</Label>
              <Input
                value={maxDuration}
                onChange={(e) => setMaxDuration(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                maxLength={4}
                className="h-11 rounded-xl px-4"
              />
            </div>
          </section>

          <Button
            className="key-signal h-12 w-full rounded-xl font-semibold"
            onClick={save}
            disabled={saving}
          >
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Save assistant settings
          </Button>
        </div>
      )}
    </div>
  );
}