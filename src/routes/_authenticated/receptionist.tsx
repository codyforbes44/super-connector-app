import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Bot, ChevronRight, Sparkles, Voicemail } from "lucide-react";
import { useState } from "react";

import { AgentList } from "@/components/receptionist/AgentList";
import { AnswerModeCard } from "@/components/receptionist/AnswerModeCard";
import { VoiceLibrary } from "@/components/receptionist/VoiceLibrary";
import { ScreenHeader } from "@/components/AppShell";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBootstrap } from "@/hooks/useBootstrap";
import { formatPhone } from "@/lib/format";

const DESCRIPTION =
  "Choose AI voices, build conversational agents and pick how every SignalBox number answers when you can't.";

export const Route = createFileRoute("/_authenticated/receptionist")({
  head: () => ({
    meta: [
      { title: "AI receptionist — SignalBox" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "AI receptionist — SignalBox" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReceptionistPage,
});

type ModeMeta = { label: string; icon: typeof Bot };

const CLASSIC_META: ModeMeta = { label: "Classic voicemail", icon: Voicemail };

const MODE_META: Record<string, ModeMeta> = {
  ai_agent: { label: "AI receptionist", icon: Bot },
  ai_greeting: { label: "AI-voiced greeting", icon: Sparkles },
  classic: CLASSIC_META,
};

function ReceptionistPage() {
  const { numbers, isAdmin } = useBootstrap();
  const qc = useQueryClient();
  const [activeSid, setActiveSid] = useState<string | null>(null);

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["bootstrap"] }),
      qc.invalidateQueries({ queryKey: ["el-agents"] }),
    ]);
  };

  const active = numbers.find((n) => n.sid === activeSid) ?? null;

  return (
    <div className="pb-8">
      <ScreenHeader
        title="AI receptionist"
        subtitle="Voices, agents and per-number answering"
        action={
          <Link
            to="/settings"
            className="key-raised grid size-9 place-items-center rounded-full text-muted-foreground"
            aria-label="Back to settings"
          >
            <ArrowLeft className="size-4" />
          </Link>
        }
      />

      <div className="px-4 pt-4">
        <Tabs defaultValue="numbers">
          <TabsList className="grid w-full grid-cols-3 rounded-full bg-muted/40 p-1">
            <TabsTrigger value="numbers" className="rounded-full text-xs">
              Numbers
            </TabsTrigger>
            <TabsTrigger value="voices" className="rounded-full text-xs">
              Voices
            </TabsTrigger>
            <TabsTrigger value="agents" className="rounded-full text-xs">
              Agents
            </TabsTrigger>
          </TabsList>

          <TabsContent value="numbers" className="mt-4 space-y-2">
            {numbers.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No numbers yet. Add one from the Numbers tab first.
              </p>
            ) : (
              numbers.map((number) => {
                const meta = MODE_META[number.answer_mode ?? "classic"] ?? CLASSIC_META;
                const Icon = meta.icon;
                return (
                  <button
                    key={number.sid}
                    type="button"
                    onClick={() => setActiveSid(number.sid)}
                    className="flex w-full items-center gap-3 rounded-2xl bg-muted/30 p-3 text-left"
                  >
                    <span className="key-raised grid size-10 shrink-0 place-items-center rounded-full">
                      <Icon className="size-4 text-primary" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {formatPhone(number.phone_number)}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {meta.label}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="voices" className="mt-4">
            <VoiceLibrary />
          </TabsContent>

          <TabsContent value="agents" className="mt-4">
            <AgentList canEdit={isAdmin} onRefresh={refresh} />
          </TabsContent>
        </Tabs>
      </div>

      <Sheet open={Boolean(active)} onOpenChange={(v) => !v && setActiveSid(null)}>
        <SheetContent
          side="bottom"
          className="app-gradient max-h-[90dvh] overflow-y-auto rounded-t-[2rem] border-border"
        >
          {active ? (
            <>
              <SheetHeader className="px-0">
                <SheetTitle className="font-display">
                  {formatPhone(active.phone_number)}
                </SheetTitle>
              </SheetHeader>
              <div className="pb-[env(safe-area-inset-bottom)]">
                <AnswerModeCard number={active} canEdit={isAdmin} onChanged={refresh} />
                <Link
                  to="/assistant/$sid"
                  params={{ sid: active.sid }}
                  className="mt-4 flex items-center justify-between rounded-2xl bg-muted/30 p-3 text-sm"
                >
                  Advanced prompt & fallback
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}