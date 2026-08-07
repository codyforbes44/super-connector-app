import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BellRing, Check, Hash, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PushNotifications } from "@/components/PushNotifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/format";
import { cn } from "@/lib/utils";

const TITLE = "Set up your workspace — SignalBox";
const DESCRIPTION =
  "Name your workspace, pick your business number and turn on alerts to finish setting up SignalBox.";

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

const STEPS = ["Workspace", "Number", "Alerts"] as const;

function Welcome() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [workspace, setWorkspace] = useState("");
  const [busy, setBusy] = useState(false);

  const numbers = useQuery({
    queryKey: ["onboarding-numbers"],
    queryFn: async () => {
      const { data } = await supabase.from("phone_numbers").select("id, phone_number").limit(5);
      return data ?? [];
    },
  });

  async function saveProfile(patch: Record<string, unknown>) {
    const { data: userData } = await supabase.auth.getUser();
    const id = userData.user?.id;
    if (!id) throw new Error("Not signed in");
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if (error) throw error;
  }

  async function next() {
    setBusy(true);
    try {
      if (step === 0) {
        await saveProfile({
          workspace_name: workspace.trim() || null,
          onboarding_step: 1,
        });
        setStep(1);
      } else if (step === 1) {
        await saveProfile({ onboarding_step: 2 });
        setStep(2);
      } else {
        await saveProfile({ onboarding_step: 3, onboarding_completed: true });
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

  return (
    <div className="px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-10">
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
            <h1 className="font-display text-2xl font-semibold">Welcome to SignalBox</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your 14-day trial is live. Let&apos;s name your workspace — you can change it later.
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
                ? "You already have a number connected. You can add more any time."
                : "Claim a number so you can start calling and texting. It takes a few taps."}
            </p>
            {hasNumber ? (
              <ul className="mt-5 space-y-2">
                {numbers.data?.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm"
                  >
                    <Check className="h-4 w-4 text-success" />
                    {row.phone_number}
                  </li>
                ))}
              </ul>
            ) : (
              <Button
                variant="secondary"
                className="mt-5 h-12 w-full rounded-full text-sm font-semibold"
                onClick={() => void navigate({ to: "/numbers" })}
              >
                Find a number
              </Button>
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

        <Button
          className="key-call mt-7 h-12 w-full rounded-full text-sm font-semibold"
          disabled={busy}
          onClick={() => void next()}
        >
          {step === 2 ? "Go to my inbox" : "Continue"}
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