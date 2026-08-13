import { useQuery } from "@tanstack/react-query";
import { Loader2, Play, Search } from "lucide-react";
import { useMemo, useRef, useState, useEffect } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/format";
import { listElevenLabsVoices, previewVoice } from "@/lib/elevenlabs.functions";

export type VoiceOption = {
  voice_id: string;
  name: string;
  category: string | null;
  labels: Record<string, string>;
  preview_url: string | null;
};

export const voicesQuery = {
  queryKey: ["el-voices"] as const,
  queryFn: () => listElevenLabsVoices(),
};

export function useVoices() {
  return useQuery(voicesQuery);
}

export function VoiceLibrary({
  selectedVoiceId,
  onSelect,
}: {
  selectedVoiceId?: string | null;
  onSelect?: (voiceId: string) => void;
}) {
  const voices = useVoices();
  const [term, setTerm] = useState("");
  const [label, setLabel] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => audioRef.current?.pause(), []);

  const list = (voices.data ?? []) as VoiceOption[];

  const labelOptions = useMemo(() => {
    const set = new Set<string>();
    for (const voice of list) {
      for (const value of Object.values(voice.labels ?? {})) {
        if (value) set.add(value);
      }
    }
    return Array.from(set).sort().slice(0, 24);
  }, [list]);

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return list.filter((voice) => {
      const values = Object.values(voice.labels ?? {});
      if (label && !values.includes(label)) return false;
      if (!needle) return true;
      return (
        voice.name.toLowerCase().includes(needle) ||
        values.some((v) => v.toLowerCase().includes(needle))
      );
    });
  }, [list, term, label]);

  async function play(voice: VoiceOption) {
    audioRef.current?.pause();
    setPlaying(voice.voice_id);
    try {
      let url = voice.preview_url;
      if (!url) {
        const result = await previewVoice({ data: { voiceId: voice.voice_id } });
        url = result.dataUrl;
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setPlaying(null);
      await audio.play();
    } catch (error) {
      toast.error(errorMessage(error));
      setPlaying(null);
    }
  }

  if (voices.isLoading) {
    return (
      <div className="grid place-items-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (voices.isError) {
    return <p className="px-1 text-sm text-destructive">{errorMessage(voices.error)}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search voices"
          className="h-11 rounded-xl pl-11 pr-4"
        />
      </div>

      {labelOptions.length ? (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {labelOptions.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setLabel(label === value ? null : value)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs capitalize transition ${
                label === value
                  ? "key-raised text-foreground"
                  : "bg-muted/40 text-muted-foreground"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      ) : null}

      <ul className="space-y-2">
        {filtered.map((voice) => {
          const active = selectedVoiceId === voice.voice_id;
          return (
            <li
              key={voice.voice_id}
              className={`flex items-center gap-3 rounded-2xl p-3 transition ${
                active ? "key-raised" : "bg-muted/30"
              }`}
            >
              <button
                type="button"
                onClick={() => void play(voice)}
                className="key-raised grid size-10 shrink-0 place-items-center rounded-full"
                aria-label={`Preview ${voice.name}`}
              >
                {playing === voice.voice_id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Play className="size-4" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{voice.name}</p>
                <p className="truncate text-xs capitalize text-muted-foreground">
                  {Object.values(voice.labels ?? {}).filter(Boolean).slice(0, 3).join(" · ") ||
                    voice.category ||
                    "Voice"}
                </p>
              </div>
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(voice.voice_id)}
                  className="rounded-full bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary"
                >
                  {active ? "Selected" : "Use"}
                </button>
              ) : null}
            </li>
          );
        })}
        {filtered.length === 0 ? (
          <li className="py-10 text-center text-sm text-muted-foreground">No voices match.</li>
        ) : null}
      </ul>
    </div>
  );
}