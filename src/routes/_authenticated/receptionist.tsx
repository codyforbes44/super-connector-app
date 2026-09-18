import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Bot, ChevronRight, PhoneOff, Sparkles, Voicemail } from "lucide-react";
import { useState } from "react";

import { AgentList } from "@/components/receptionist/AgentList";
import { AnswerModeCard } from "@/components/receptionist/AnswerModeCard";
import { VoiceLibrary } from "@/components/receptionist/VoiceLibrary";
import { ScreenHeader } from "@/components/AppShell";
import { Empty, ListGroup, Row, Screen } from "@/components/screen";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBootstrap } from "@/hooks/useBootstrap";
import { formatPhone } from "@/lib/format";

const DESCRIPTION =
  "Choose AI voices, build conversational agents and pick how every SixVox number answers when you can't.";

export const Route = createFileRoute("/_authenticated/receptionist")({
  head: () => ({
    meta: [
      { title: "AI receptionist — SixVox" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "AI receptionist — SixVox" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReceptionistPage,
});

type ModeMeta = { label: string; icon: typeof Bot };

const CLASSIC_META: ModeMeta = { label: "Rings you, then voicemail", icon: Voicemail };

const MODE_META: Record<string, ModeMeta> = {
  ai_agent: { label: "AI receptionist answers", icon: Bot },
  ai_greeting: { label: "AI greets, then voicemail", icon: Sparkles },
  classic: CLASSIC_META,
};

/** Plain-English line under each number: what actually happens on a call. */
function modeMeta(number: { answer_mode?: string | null; forward_to?: string | null }): ModeMeta {
  const meta = MODE_META[number.answer_mode ?? "classic"] ?? CLASSIC_META;
  if (meta === CLASSIC_META && number.forward_to) {
    return { label: "Forwards your calls, then voicemail", icon: Voicemail };
  }
  return meta;
}

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
    <div className="min-w-0">
      <ScreenHeader
        title="AI receptionist"
        subtitle="Voices, agents and per-number answering"
        action={
          <Link
            to="/settings"
            className="grid size-9 place-items-center rounded-xl bg-secondary text-muted-foreground"
            aria-label="Back to settings"
          >
            <ArrowLeft className="size-4" />
          </Link>
        }
      />

      <Screen onRefresh={refresh}>
        <Tabs defaultValue="numbers">
          <TabsList className="grid w-full grid-cols-3 rounded-xl bg-secondary p-1">
            <TabsTrigger value="numbers" className="rounded-lg text-xs">
              Numbers
            </TabsTrigger>
            <TabsTrigger value="voices" className="rounded-lg text-xs">
              Voices
            </TabsTrigger>
            <TabsTrigger value="agents" className="rounded-lg text-xs">
              Agents
            </TabsTrigger>
          </TabsList>

          <TabsContent value="numbers" className="mt-4">
            {numbers.length === 0 ? (
              <Empty
                icon={PhoneOff}
                title="No numbers yet"
                description="Add a number first and it will show up here with its answering mode."
              />
            ) : (
              <ListGroup>
                {numbers.map((number) => {
                  const meta = modeMeta(number);
                  return (
                    <Row
                      key={number.sid}
                      icon={meta.icon}
                      iconClassName="bg-primary/15 text-primary"
                      title={formatPhone(number.phone_number)}
                      subtitle={meta.label}
                      chevron
                      onClick={() => setActiveSid(number.sid)}
                    />
                  );
                })}
              </ListGroup>
            )}
          </TabsContent>

          <TabsContent value="voices" className="mt-4">
            <VoiceLibrary />
          </TabsContent>

          <TabsContent value="agents" className="mt-4">
            <AgentList canEdit={isAdmin} onRefresh={refresh} />
          </TabsContent>
        </Tabs>
      </Screen>

      <Sheet open={Boolean(active)} onOpenChange={(v) => !v && setActiveSid(null)}>
        <SheetContent
          side="bottom"
          className="max-h-[90dvh] overflow-y-auto rounded-t-3xl border-border bg-card"
        >
          {active ? (
            <>
              <SheetHeader className="px-0">
                <SheetTitle className="font-display">{formatPhone(active.phone_number)}</SheetTitle>
              </SheetHeader>
              <div className="pb-[env(safe-area-inset-bottom)]">
                <AnswerModeCard number={active} canEdit={isAdmin} onChanged={refresh} />
                <Link
                  to="/assistant/$sid"
                  params={{ sid: active.sid }}
                  className="mt-4 flex items-center justify-between rounded-2xl border border-border bg-secondary/40 p-3 text-sm"
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
