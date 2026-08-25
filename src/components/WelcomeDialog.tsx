import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

/**
 * First-run greeting for accounts provisioned by an admin (they skip the
 * onboarding wizard entirely). Shown once, then the flag is cleared.
 */
export function WelcomeDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [number, setNumber] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const id = userData.user?.id;
      if (!id) return;
      const { data } = await supabase
        .from("profiles")
        .select("display_name, default_number, onboarding_state")
        .eq("id", id)
        .maybeSingle();
      if (cancelled || !data) return;
      const state = (data.onboarding_state ?? {}) as Record<string, unknown>;
      if (state["welcome_pending"] !== true) return;
      setName((data.display_name ?? "").split(" ")[0] ?? null);
      setNumber(data.default_number ?? null);
      setOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function dismiss() {
    setOpen(false);
    const { data: userData } = await supabase.auth.getUser();
    const id = userData.user?.id;
    if (!id) return;
    const { data } = await supabase
      .from("profiles")
      .select("onboarding_state")
      .eq("id", id)
      .maybeSingle();
    const state = ((data?.onboarding_state ?? {}) as Record<string, unknown>) || {};
    await supabase
      .from("profiles")
      .update({ onboarding_state: { ...state, welcome_pending: false } })
      .eq("id", id);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : void dismiss())}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogTitle className="font-display text-xl">
          Welcome to SixVox{name ? `, ${name}` : ""}
        </DialogTitle>
        <DialogDescription className="text-sm">
          {number
            ? `Your line ${formatNumber(number)} is live — calls and texts land right here.`
            : "Your workspace is ready — calls and texts land right here."}
        </DialogDescription>
        <div className="mt-2 grid gap-2">
          <Button asChild onClick={() => void dismiss()}>
            <Link to="/calls" search={{}}>
              Open the dialer
            </Link>
          </Button>
          <Button asChild variant="secondary" onClick={() => void dismiss()}>
            <Link to="/inbox">Go to inbox</Link>
          </Button>
          <Button variant="ghost" onClick={() => void dismiss()}>
            Look around first
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return value;
}
