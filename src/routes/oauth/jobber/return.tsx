import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { finishJobberConnect } from "@/lib/trade.functions";

export const Route = createFileRoute("/oauth/jobber/return")({
  ssr: false,
  component: JobberReturn,
  head: () => ({
    meta: [
      { title: "Finishing Jobber connection · SixVox" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function JobberReturn() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Finishing your Jobber connection…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) {
      setMessage("Jobber did not return an authorization code.");
      return;
    }
    void finishJobberConnect({ data: { code, state } })
      .then(() => {
        void navigate({ to: "/integrations" });
      })
      .catch(() => {
        setMessage("Could not finish the Jobber connection. You can close this tab and try again.");
      });
  }, [navigate]);

  return (
    <main className="flex min-h-dvh items-center justify-center p-6 text-center">
      <div className="glass-panel flex items-center gap-3 rounded-2xl px-5 py-4">
        <Loader2 className="size-4 animate-spin" />
        <p className="text-sm">{message}</p>
      </div>
    </main>
  );
}
