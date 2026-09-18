import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Mail, PhoneCall } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { errorMessage } from "@/lib/format";
import { PLANS, type BillingInterval, type PlanCode } from "@/lib/plans";
import { safeRedirectPath, useSession } from "@/hooks/useSession";
import { isRemembered, setRememberMe } from "@/lib/session-keeper";

const TITLE = "Sign in or start your free trial — SixVox";

/**
 * OAuth/email links must return to a PUBLIC same-origin URL. `/auth` forwards
 * the (now signed-in) user to the saved destination once the session hydrates.
 */
function returnUrl(next?: string) {
  const origin = window.location.origin;
  return next ? `${origin}/auth?redirect=${encodeURIComponent(next)}` : origin;
}
const DESCRIPTION =
  "Sign in to SixVox or create an account to run your business calls, texts and AI receptionist from your phone.";

export const Route = createFileRoute("/auth")({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    mode?: "signin" | "signup";
    plan?: PlanCode;
    interval?: BillingInterval;
    redirect?: string;
  } => {
    const plan = PLANS.find((item) => item.code === search["plan"])?.code;
    const next = safeRedirectPath(search["redirect"]);
    return {
      mode: search["mode"] === "signup" ? "signup" : "signin",
      ...(plan ? { plan } : {}),
      ...(plan ? { interval: search["interval"] === "year" ? "year" : "month" } : {}),
      ...(next ? { redirect: next } : {}),
    };
  },
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
  component: AuthScreen,
});

function AuthScreen() {
  const navigate = useNavigate();
  const { mode: initialMode, plan, interval, redirect: next } = Route.useSearch();
  const { status } = useSession();
  const [mode, setMode] = useState<"signin" | "signup">(initialMode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const [remember, setRemember] = useState(true);

  // Reflect the last choice made on this device.
  useEffect(() => {
    setRemember(isRemembered());
  }, []);

  const nextDestination = () => {
    if (plan) {
      return navigate({ to: "/billing", search: { plan, interval: interval ?? "month" } });
    }
    if (next) return navigate({ to: next } as never);
    return navigate({ to: "/welcome" });
  };

  // Reactive: forwards the user as soon as a persisted session is restored,
  // including a session that hydrates after this screen has mounted.
  useEffect(() => {
    if (status !== "signedIn") return;
    if (next) {
      void navigate({ to: next, replace: true } as never);
      return;
    }
    void navigate({ to: "/inbox", replace: true });
  }, [status, next, navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setRememberMe(remember);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: returnUrl(next),
            data: { display_name: name },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setCheckEmail(true);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      await nextDestination();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    setRememberMe(remember);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: returnUrl(next),
    });
    if (result.error) {
      setBusy(false);
      toast.error("Google sign-in failed. Try again or use email.");
      return;
    }
    if (result.redirected) return;
    await nextDestination();
  }

  if (checkEmail) {
    return (
      <main className="app-gradient safe-bottom mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-6">
        <div className="glass-panel rounded-[2rem] px-6 py-10 text-center">
          <span className="key-signal mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full">
            <Mail className="h-6 w-6" />
          </span>
          <h1 className="font-display text-2xl font-semibold">Check your inbox</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a confirmation link to <span className="text-foreground">{email}</span>. Open it
            to finish creating your SixVox account.
          </p>
          <Button variant="ghost" className="mt-6" onClick={() => setCheckEmail(false)}>
            Back to sign in
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="app-gradient safe-bottom relative mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center overflow-hidden px-6 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 right-0 h-56 w-56 rounded-full bg-primary/25 blur-3xl"
      />
      <div className="glass-panel relative rounded-[2rem] p-6">
      <span className="key-signal mb-5 flex h-14 w-14 items-center justify-center rounded-xl">
        <PhoneCall className="h-6 w-6" />
      </span>
      <h1 className="font-display text-3xl font-semibold">
        {mode === "signin" ? "Welcome back" : "Start your free trial"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {mode === "signin"
          ? "Sign in to your SixVox workspace."
          : "14 days free. No card required. Set up in about a minute."}
      </p>

      <Button
        type="button"
        variant="secondary"
        className="mt-7 h-12 w-full rounded-xl text-sm font-semibold"
        disabled={busy}
        onClick={handleGoogle}
      >
        Continue with Google
      </Button>

      <div className="my-5 flex items-center gap-3 text-[0.7rem] tracking-wide text-muted-foreground uppercase">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "signup" ? (
          <div className="space-y-1.5">
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            className="h-12 rounded-xl px-4 text-base"
              autoComplete="name"
              maxLength={80}
            />
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-xl px-4 text-base"
            autoComplete="email"
            maxLength={255}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 rounded-xl px-4 text-base"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
        </div>
        <Button
          type="submit"
          className="key-signal h-12 w-full rounded-xl text-sm font-semibold"
          disabled={busy}
        >
          {mode === "signin" ? "Sign in" : "Start free trial"}
        </Button>
      </form>

      <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl px-1 text-sm">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => {
            setRemember(e.target.checked);
            setRememberMe(e.target.checked);
          }}
          className="h-5 w-5 shrink-0 rounded-md border border-border bg-transparent accent-[var(--color-primary)]"
        />
        <span className="min-w-0">
          <span className="font-medium">Keep me signed in</span>
          <span className="block text-xs text-muted-foreground">
            {remember
              ? "Stay signed in on this device until you sign out."
              : "Sign out automatically when you close this browser or tab."}
          </span>
        </span>
      </label>

      <button
        type="button"
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
      >
        {mode === "signin"
          ? "No account yet? Start a free trial"
          : "Already have an account? Sign in"}
      </button>
      </div>
    </main>
  );
}