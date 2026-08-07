import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { completeGmailConnect } from "@/lib/gmail-connect.functions";

export const Route = createFileRoute("/oauth/google/return")({
  ssr: false,
  component: OAuthReturn,
  head: () => ({
    meta: [
      { title: "Finishing Google connection · SixVox" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function OAuthReturn() {
  const [message, setMessage] = useState("Finishing your Google connection…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const notify = (
      type: "appUserConnectorOAuthComplete" | "appUserConnectorOAuthFailed",
    ) => {
      window.opener?.postMessage(
        { type, connectorId: "google_mail" },
        window.location.origin,
      );
      window.close();
    };

    if (params.get("success") !== "true") {
      setMessage(params.get("error") ?? "Google sign-in did not complete.");
      notify("appUserConnectorOAuthFailed");
      return;
    }

    const code = params.get("code");
    if (!code) {
      if (params.get("offline_access_allowed") === "false") {
        notify("appUserConnectorOAuthComplete");
        return;
      }
      setMessage("Google returned no exchange code.");
      notify("appUserConnectorOAuthFailed");
      return;
    }

    void completeGmailConnect({ data: { code } })
      .then(() => notify("appUserConnectorOAuthComplete"))
      .catch(() => {
        setMessage("Could not finish the Google connection.");
        notify("appUserConnectorOAuthFailed");
      });
  }, []);

  return (
    <main className="flex min-h-dvh items-center justify-center p-6 text-center">
      <div className="glass-panel flex items-center gap-3 rounded-2xl px-5 py-4">
        <Loader2 className="size-4 animate-spin" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </main>
  );
}