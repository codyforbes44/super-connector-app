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

const TITLE = "Sign in or start your free trial — SignalBox";
const DESCRIPTION =
  "Sign in to SignalBox or create an account to run your business calls, texts, WhatsApp and AI receptionist from your phone.";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    mode: search["mode"] === "signup" ? ("signup" as const) : ("signin" as const),
  }),
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
  const { mode: initialMode } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/inbox" });
    });
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
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
      await navigate({ to: "/welcome" });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Google sign-in failed. Try again or use email.");
      return;
    }
    if (result.redirected) return;
    await navigate({ to: "/welcome" });
  }

  if (checkEmail) {
    return (
      <div className="app-gradient mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-6">
        <div className="glass-panel rounded-[2rem] px-6 py-10 text-center">
          <span className="key-signal mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full">
            <Mail className="h-6 w-6" />
          </span>
          <h1 className="font-display text-2xl font-semibold">Check your inbox</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a confirmation link to <span className="text-foreground">{email}</span>. Open it
            to finish creating your SignalBox account.
          </p>
          <Button variant="ghost" className="mt-6" onClick={() => setCheckEmail(false)}>
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-gradient relative mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center overflow-hidden px-6 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 right-0 h-56 w-56 rounded-full bg-primary/25 blur-3xl"
      />
      <div className="glass-panel relative rounded-[2rem] p-6">
      <span className="key-signal mb-5 flex h-14 w-14 items-center justify-center rounded-full">
        <PhoneCall className="h-6 w-6" />
      </span>
      <h1 className="font-display text-3xl font-semibold">
        {mode === "signin" ? "Welcome back" : "Start your free trial"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {mode === "signin"
          ? "Sign in to your SignalBox workspace."
          : "14 days free. No card required. Set up in about a minute."}
      </p>

      <Button
        type="button"
        variant="secondary"
        className="mt-7 h-12 w-full rounded-full text-sm font-semibold"
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
            className="h-12 rounded-full px-4"
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
            className="h-12 rounded-full px-4"
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
            className="h-12 rounded-full px-4"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
        </div>
        <Button
          type="submit"
          className="key-call h-12 w-full rounded-full text-sm font-semibold"
          disabled={busy}
        >
          {mode === "signin" ? "Sign in" : "Start free trial"}
        </Button>
      </form>

      <button
        type="button"
        className="mt-6 text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
      >
        {mode === "signin"
          ? "No account yet? Start a free trial"
          : "Already have an account? Sign in"}
      </button>
      </div>
    </div>
  );
}