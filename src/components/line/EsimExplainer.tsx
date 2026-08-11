import { Globe, Nfc, ShieldCheck } from "lucide-react";

/**
 * Users often ask for an "eSIM". A web app cannot install a carrier profile —
 * only the phone's OS can. This explains the honest answer and points at the
 * forwarding setup that gives them the same outcome for free.
 */
export function EsimExplainer() {
  return (
    <details className="glass-panel group rounded-3xl p-4">
      <summary className="flex cursor-pointer list-none items-center gap-3">
        <span className="key-raised grid size-10 shrink-0 place-items-center rounded-full">
          <Nfc className="size-4 text-primary" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Do I need a SIM or eSIM?</span>
          <span className="block text-xs text-muted-foreground">
            Short answer: no — SixVox works over data and forwarding.
          </span>
        </span>
      </summary>

      <div className="mt-3 space-y-3 text-xs text-muted-foreground">
        <p>
          SixVox lines are cloud numbers. They ring inside the app over Wi-Fi or mobile data, so
          there is no plastic SIM to swap and nothing to install in your phone&apos;s settings.
        </p>
        <ul className="space-y-2">
          <li className="flex gap-2.5 rounded-2xl bg-muted/30 p-3">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              <span className="block font-semibold text-foreground">Keep your carrier number</span>
              Set up forwarding below and your existing number keeps working exactly as it does
              today — SixVox only picks up what you miss.
            </span>
          </li>
          <li className="flex gap-2.5 rounded-2xl bg-muted/30 p-3">
            <Globe className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              <span className="block font-semibold text-foreground">Travelling abroad</span>
              Any local Wi-Fi or travel data plan is enough. Your SixVox number keeps ringing with no
              roaming charges on the call itself.
            </span>
          </li>
        </ul>
        <p>
          A SixVox-branded eSIM would replace your mobile carrier entirely — that&apos;s a mobile
          network product, not something an app can install. Forwarding gives you the same second
          line today.
        </p>
      </div>
    </details>
  );
}
