<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

SixVox branding derives from the user-supplied 3BI mark (vector master `src/assets/sixvox-logo.svg`, raster source `src/assets/sixvox-logo-signal.png`); regenerate every favicon, app icon, splash, notification, shortcut, and share image with `scripts/regen-brand.py` instead of hand-editing them, so all instances stay consistent.
The mobile-first page system is defined by semantic colors in `src/styles.css`, shared page primitives in `src/components/screen.tsx`, and the signed-in navigation in `src/components/AppShell.tsx`; reuse these so pages retain consistent sizing and accessibility.
Unattributed carrier webhook errors retain a null workspace and are visible only to platform super admins; assigning an unknown number to a tenant would leak diagnostics across workspaces.
- Platform (super admin) controls live under `src/routes/_authenticated/platform/` backed by `src/lib/platform.functions.ts`; every handler re-checks `is_super_admin` server-side and admin actions write to `audit_log` — keeps tenant Settings free of platform tools.
- iMessage/RCS replies arrive via Claw Messenger managed webhook at `/api/public/claw/inbound` (shared `CLAW_WEBHOOK_TOKEN`), threaded into the SMS conversation for `CLAW_HOME_NUMBER` with the real channel on the message row — Claw self-serve inbound is WebSocket-only, which Workers cannot hold.
- Provider ingestion uses database-backed provider identities, confirmed import SID snapshots, and atomic concierge transcript replacement; never merge different carrier IDs by matching phone/time because separate forwarded calls can look identical.
- Confirmed self-forwarded calls use persistent SID aliases backed by a unique matching carrier child leg; alias guards prevent reimport and remap transcript/recording writes without altering carrier routing or ambiguous calls.
- Message delivery receipts persist before message insertion and apply atomically; MMS reads authorize the stored message with user RLS before fetching provider media into private storage and returning short-lived links.
- Provider HTTP calls go through `fetchWithRetry` (`src/lib/provider-retry.ts`): creates retry only on 429 so a text/call is never duplicated; final non-GET failures are recorded as `<provider>-api` rows in `webhook_errors` for Platform → Health.
