import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BellRing,
  Check,
  Hash,
  Loader2,
  PhoneCall,
  Search,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { PushNotifications } from "@/components/PushNotifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage, formatPhone } from "@/lib/format";
import { purchaseNumber, searchAvailableNumbers, sendTestCall } from "@/lib/twilio.functions";
import { cn } from "@/lib/utils";

const TITLE = "Set up your workspace — SixVox";
const DESCRIPTION =
  "Name your workspace, claim your number, turn on alerts and take your first call — in under two minutes.";

export const Route = createFileRoute("/_authenticated/welcome")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Welcome,
});

const STEPS = ["Workspace", "Number", "Alerts", "First call"] as const;
const TARGET_SECONDS = 120;

type Available = { phone_number: string; friendly_name?: string; locality?: string; region?: string };

function useElapsed() {
  const start = useRef(Date.now());
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = window.setInterval(
      () => setSeconds(Math.floor((Date.now() - start.current) / 1000)),
      1000,
    );
    return () => window.clearInterval(id);
  }, []);
  return seconds;
}

function Welcome() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const elapsed = useElapsed();
  const [step, setStep] = useState(0);
  const [workspace, setWorkspace] = useState("");
  const [busy, setBusy] = useState(false);

  // Step 2 — claim a number without leaving the flow.
  const [areaCode, setAreaCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [options, setOptions] = useState<Available[]>([]);
  const [claiming, setClaiming] = useState<string | null>(null);

  // Step 4 — ring the user's own phone so the first call happens right here.
  const [myPhone, setMyPhone] = useState("");
  const [called, setCalled] = useState(false);

  const numbers = useQuery({
    queryKey: ["onboarding-numbers"],
    queryFn: async () => {
      const { data } = await supabase.from("phone_numbers").select("id, phone_number").limit(5);
      return data ?? [];
    },
  });

  type ProfilePatch = {
    workspace_name?: string | null;
    agent_phone?: string | null;
    onboarding_step?: number;
    onboarding_completed?: boolean;
    onboarding_skipped?: boolean;
  };

  async function saveProfile(patch: ProfilePatch) {
    const { data: userData } = await supabase.auth.getUser();
    const id = userData.user?.id;
    if (!id) throw new Error("Not signed in");
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if (error) throw error;
  }

  async function runSearch() {
    setSearching(true);
    try {
      const code = areaCode.trim();
      const result = (await searchAvailableNumbers({
        data: { country: "US", type: "local", ...(code ? { areaCode: code } : {}) },
      })) as unknown as { numbers?: Available[] } | Available[];
      const list = Array.isArray(result) ? result : (result.numbers ?? []);
      setOptions(list.slice(0, 3));
      if (list.length === 0) toast.info("No numbers in that area code — try another.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSearching(false);
    }
  }

  async function claim(phoneNumber: string) {
    setClaiming(phoneNumber);
    try {
      await purchaseNumber({ data: { phoneNumber } });
      await queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      await numbers.refetch();
      setOptions([]);
      toast.success(`${formatPhone(phoneNumber)} is yours.`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setClaiming(null);
    }
  }

  async function ringMe() {
    const target = myPhone.trim();
    if (target.length < 7) {
      toast.error("Enter the mobile number you want us to ring.");
      return;
    }
    setBusy(true);
    try {
      await saveProfile({ agent_phone: target });
      await sendTestCall({ data: { to: target } });
      setCalled(true);
      toast.success("Calling you now — pick up to hear your line.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    setBusy(true);
    try {
      if (step === 0) {
        await saveProfile({ workspace_name: workspace.trim() || null, onboarding_step: 1 });
        setStep(1);
      } else if (step === 1) {
        await saveProfile({ onboarding_step: 2 });
        setStep(2);
      } else if (step === 2) {
        await saveProfile({ onboarding_step: 3 });
        setStep(3);
      } else {
        await saveProfile({ onboarding_step: 4, onboarding_completed: true });
        await queryClient.invalidateQueries();
        await navigate({ to: "/inbox" });
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function skip() {
    setBusy(true);
    try {
      await saveProfile({ onboarding_skipped: true });
      await navigate({ to: "/inbox" });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const hasNumber = (numbers.data?.length ?? 0) > 0;
  const clock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  const onPace = elapsed <= TARGET_SECONDS;

  return (
    <div className="px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-10">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">
          Step {step + 1} of {STEPS.length}
        </p>
        <p
          className={cn(
            "rounded-full px-2.5 py-1 text-[0.7rem] font-semibold tabular-nums",
            onPace ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          {clock} {onPace ? "· under 2 min" : "· almost there"}
        </p>
      </div>

      <div className="flex items-center gap-1.5">
        {STEPS.map((label, index) => (
          <div key={label} className="flex-1">
            <span
              className={cn(
                "block h-1 rounded-full transition-colors",
                index <= step ? "bg-primary" : "bg-border",
              )}
            />
            <span
              className={cn(
                "mt-1.5 block text-[0.65rem] font-medium",
                index <= step ? "text-primary" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      <div className="glass-panel mt-6 rounded-[2rem] p-5 sm:p-6">
        {step === 0 ? (
          <>
            <span className="key-signal mb-4 flex h-14 w-14 items-center justify-center rounded-full">
              <Sparkles className="h-6 w-6" />
            </span>
            <h1 className="font-display text-2xl font-semibold">Welcome to SixVox</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Four quick steps and you&apos;ll be taking calls. Start with a name for your
              workspace — you can change it later.
            </p>
            <div className="mt-6 space-y-1.5">
              <Label htmlFor="workspace">Workspace name</Label>
              <Input
                id="workspace"
                value={workspace}
                onChange={(event) => setWorkspace(event.target.value)}
                placeholder="Acme Plumbing"
                className="h-12 rounded-full px-4"
                maxLength={80}
              />
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <span className="key-signal mb-4 flex h-14 w-14 items-center justify-center rounded-full">
              <Hash className="h-6 w-6" />
            </span>
            <h1 className="font-display text-2xl font-semibold">Your business number</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {hasNumber
                ? "You already have a line connected. You can add more any time."
                : "Pick an area code and claim a number — it goes live the moment you tap it."}
            </p>

            {hasNumber ? (
              <ul className="mt-5 space-y-2">
                {numbers.data?.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm"
                  >
                    <Check className="h-4 w-4 text-success" />
                    {formatPhone(row.phone_number)}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-5 space-y-3">
                <div className="flex gap-2">
                  <Input
                    inputMode="numeric"
                    value={areaCode}
                    onChange={(event) =>
                      setAreaCode(event.target.value.replace(/\D/g, "").slice(0, 3))
                    }
                    placeholder="Area code (512)"
                    className="h-12 flex-1 rounded-full px-4"
                    aria-label="Area code"
                  />
                  <Button
                    variant="secondary"
                    className="h-12 rounded-full px-5 font-semibold"
                    onClick={() => void runSearch()}
                    disabled={searching}
                  >
                    {searching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    <span className="ml-1.5">Search</span>
                  </Button>
                </div>

                {options.map((option) => (
                  <button
                    key={option.phone_number}
                    type="button"
                    onClick={() => void claim(option.phone_number)}
                    disabled={claiming !== null}
                    className="surface-row flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-opacity disabled:opacity-60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{formatPhone(option.phone_number)}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[option.locality, option.region].filter(Boolean).join(", ") || "Local line"}
                      </p>
                    </div>
                    {claiming === option.phone_number ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      <span className="text-xs font-semibold text-primary">Claim</span>
                    )}
                  </button>
                ))}

                <button
                  type="button"
                  className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
                  onClick={() => void navigate({ to: "/numbers" })}
                >
                  Or bring the number you already use
                </button>
              </div>
            )}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <span className="key-signal mb-4 flex h-14 w-14 items-center justify-center rounded-full">
              <BellRing className="h-6 w-6" />
            </span>
            <h1 className="font-display text-2xl font-semibold">Never miss a customer</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Turn on alerts so new messages and missed calls reach you instantly.
            </p>
            <div className="mt-5">
              <PushNotifications />
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <span className="key-signal mb-4 flex h-14 w-14 items-center justify-center rounded-full">
              <PhoneCall className="h-6 w-6" />
            </span>
            <h1 className="font-display text-2xl font-semibold">Take your first call</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We&apos;ll ring your own phone from your SixVox line so you can hear it working. This
              is also the number we bridge calls to when you&apos;re away from the app.
            </p>
            <div className="mt-5 space-y-3">
              <Label htmlFor="myphone">Your mobile number</Label>
              <Input
                id="myphone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={myPhone}
                onChange={(event) => setMyPhone(event.target.value)}
                placeholder="+1 512 555 0148"
                className="h-12 rounded-full px-4"
              />
              <Button
                variant="secondary"
                className="h-12 w-full rounded-full font-semibold"
                onClick={() => void ringMe()}
                disabled={busy || !hasNumber}
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PhoneCall className="mr-2 h-4 w-4" />
                )}
                {called ? "Ring me again" : "Ring my phone"}
              </Button>
              {!hasNumber ? (
                <p className="text-xs text-muted-foreground">
                  Claim a number in the previous step to place your first call.
                </p>
              ) : null}
              {called ? (
                <p className="flex items-center gap-1.5 text-xs text-success">
                  <Check className="h-3.5 w-3.5" /> Call placed — you&apos;re live.
                </p>
              ) : null}
            </div>
          </>
        ) : null}

        <Button
          className="key-call mt-7 h-12 w-full rounded-full text-sm font-semibold"
          disabled={busy}
          onClick={() => void next()}
        >
          {step === STEPS.length - 1 ? "Go to my inbox" : "Continue"}
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
        <button
          type="button"
          className="mt-4 w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
          disabled={busy}
          onClick={() => void skip()}
        >
          Skip setup for now
        </button>
      </div>
    </div>
  );
}
