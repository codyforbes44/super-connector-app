import { useConversation } from "@elevenlabs/react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Loader2, Mic, MicOff, MessageCircle, Send, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useSession } from "@/hooks/useSession";
import { cn } from "@/lib/utils";

type Turn = { id: string; role: "you" | "vox"; text: string };

const OPENER = "Hey, I'm Vox. Ask me anything about SixVox — pricing, setup, or what it does.";

const PROMPTS = ["What does SixVox cost?", "Can it answer calls for me?", "Can I keep my number?"];

export function VoxConcierge() {
  const [open, setOpen] = useState(false);
  const [voice, setVoice] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const startedRef = useRef(false);
  const sessionRef = useRef<{ key: string; startedAt: number } | null>(null);
  const turnsRef = useRef<Turn[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { session } = useSession();

  const push = useCallback((role: Turn["role"], text: string) => {
    if (!text.trim()) return;
    setTurns((prev) => [...prev, { id: `${Date.now()}-${prev.length}`, role, text: text.trim() }]);
  }, []);

  /** Store what was said so the team can read it back in the app. */
  const persist = useCallback(() => {
    const session = sessionRef.current;
    if (!session || !turnsRef.current.length) return;
    const payload = JSON.stringify({
      sessionKey: session.key,
      durationSeconds: (Date.now() - session.startedAt) / 1000,
      turns: turnsRef.current.map((turn) => ({
        role: turn.role === "you" ? "user" : "assistant",
        content: turn.text,
      })),
    });
    const url = "/api/public/agent/transcript";
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
      return;
    }
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }, []);

  const conversation = useConversation({
    textOnly: !voice,
    onConnect: () => setError(null),
    onDisconnect: () => {
      startedRef.current = false;
      persist();
    },
    onError: (event: unknown) => {
      setError(typeof event === "string" ? event : "The concierge dropped out. Try again.");
      startedRef.current = false;
    },
    onMessage: (message: { source?: string; message?: string }) => {
      if (!message?.message) return;
      push(message.source === "user" ? "you" : "vox", message.message);
    },
    clientTools: {
      navigate: (params: { path?: string }) => {
        const path = params?.path ?? "";
        if (path.startsWith("/") && !path.startsWith("//")) {
          void navigate({ to: path });
          return `Opened ${path}.`;
        }
        return "That path is not part of the SixVox site.";
      },
      start_signup: (params: { plan?: string }) => {
        void navigate({
          to: "/auth",
          search: {
            mode: "signup" as const,
            ...(params?.plan === "solo" || params?.plan === "team" || params?.plan === "scale"
              ? { plan: params.plan }
              : {}),
          },
        });
        return "Opened the signup page.";
      },
      open_app_screen: (params: { screen?: string }) => {
        const screen = (params?.screen ?? "").replace(/^\/+/, "");
        if (!screen) return "No screen given.";
        void navigate({ to: `/${screen}` });
        return `Opened ${screen}.`;
      },
    },
  });

  const connected = conversation.status === "connected";

  const start = useCallback(
    async (asVoice: boolean) => {
      if (startedRef.current) return true;
      startedRef.current = true;
      setStarting(true);
      setError(null);
      try {
        if (asVoice) await navigator.mediaDevices.getUserMedia({ audio: true });

        const response = await fetch("/api/public/agent/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({
            mode: asVoice ? "voice" : "text",
            page: pathname,
            pageTitle: document.title,
            referrer: document.referrer,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            localTime: new Date().toLocaleTimeString(),
            device: window.matchMedia("(max-width: 640px)").matches ? "mobile" : "desktop",
          }),
        });
        if (!response.ok) throw new Error("unavailable");
        const data = (await response.json()) as {
          token: string;
          sessionKey: string;
          variables: Record<string, string>;
        };
        sessionRef.current = { key: data.sessionKey, startedAt: Date.now() };

        await conversation.startSession({
          conversationToken: data.token,
          connectionType: "webrtc",
          textOnly: !asVoice,
          dynamicVariables: data.variables,
        });
        return true;
      } catch (cause) {
        console.error("concierge start failed", cause);
        startedRef.current = false;
        setError(
          asVoice
            ? "I couldn't reach the microphone or the concierge. Text still works."
            : "The concierge is unavailable right now. Try the contact page.",
        );
        return false;
      } finally {
        setStarting(false);
      }
    },
    [conversation, pathname, session?.access_token],
  );

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message) return;
      setInput("");
      const ready = connected || (await start(false));
      if (!ready) return;
      push("you", message);
      conversation.sendUserMessage(message);
      inputRef.current?.focus();
    },
    [connected, conversation, push, start],
  );

  const toggleVoice = useCallback(async () => {
    if (voice) {
      await conversation.endSession();
      startedRef.current = false;
      setVoice(false);
      return;
    }
    if (connected) {
      await conversation.endSession();
      startedRef.current = false;
    }
    setVoice(true);
  }, [connected, conversation, voice]);

  // Starting the voice session has to wait for the hook to pick up textOnly:false.
  useEffect(() => {
    if (voice && !connected && !startedRef.current) void start(true);
  }, [connected, start, voice]);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [open, turns.length, conversation.status]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const onHide = () => persist();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      persist();
      void Promise.resolve(conversation.endSession()).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Chat with Vox, the SixVox concierge"
        className="key-signal fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-40 flex h-14 md:bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] items-center gap-2 rounded-full px-5 text-sm font-semibold shadow-lg"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="hidden sm:inline">Ask Vox</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-50 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[23rem]">
      <div className="glass-panel flex max-h-[75vh] flex-col overflow-hidden rounded-[1.75rem]">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-primary/15">
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full bg-primary",
                connected && conversation.isSpeaking && "animate-ping",
              )}
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-semibold">Vox</p>
            <p className="truncate text-[0.7rem] text-muted-foreground">
              {starting
                ? "Connecting…"
                : connected
                  ? voice
                    ? conversation.isSpeaking
                      ? "Speaking"
                      : "Listening"
                    : "Online"
                  : "SixVox concierge"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void toggleVoice()}
            aria-label={voice ? "Switch to text" : "Talk to Vox"}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full border border-border",
              voice && "bg-primary/15 text-primary",
            )}
          >
            {voice ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => {
              void Promise.resolve(conversation.endSession()).catch(() => {});
              startedRef.current = false;
              setVoice(false);
              setOpen(false);
            }}
            aria-label="Close the concierge"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          <p className="text-sm leading-relaxed text-muted-foreground">{OPENER}</p>
          {turns.map((turn) => (
            <div
              key={turn.id}
              className={cn("flex", turn.role === "you" ? "justify-end" : "justify-start")}
            >
              <p
                className={cn(
                  "max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap",
                  turn.role === "you"
                    ? "rounded-2xl bg-primary px-3.5 py-2 font-medium text-primary-foreground"
                    : "text-foreground",
                )}
              >
                {turn.text}
              </p>
            </div>
          ))}
          {starting ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Waking Vox…
            </p>
          ) : null}
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          {!turns.length && !starting ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void send(prompt)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground"
                >
                  {prompt}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send(input);
          }}
          className="flex items-end gap-2 border-t border-border px-3 py-3"
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send(input);
              }
            }}
            placeholder={voice ? "Talk, or type here" : "Ask about SixVox…"}
            className="max-h-24 min-h-10 flex-1 resize-none rounded-2xl border border-border bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            aria-label="Send"
            className="key-signal flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
