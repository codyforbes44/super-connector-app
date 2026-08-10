# Offline support for installed SixVox app

Today SixVox is installable (manifest + icons) and has a push-notification worker, but nothing works without a connection: opening the installed app offline shows a browser error page. This adds a proper offline app shell while keeping push alerts working exactly as they do now.

## What changes for users

- Installed app opens instantly offline and shows the SixVox shell instead of a browser error.
- A friendly "You're offline" screen appears when a page needs data that isn't cached.
- App updates apply automatically in the background on the next launch.
- Push alerts, ringing notifications and Answer actions are unchanged.
- Offline behavior only applies to the published app — the Lovable editor preview intentionally never registers a service worker.

## How it works

Use `vite-plugin-pwa` in `generateSW` mode, emitting `/sw.js`:

- `registerType: "autoUpdate"`, `injectRegister: null`, `devOptions.enabled: false`.
- `importScripts: ["/push-sw.js"]` so the single root-scope worker keeps all existing push, call-notification and notification-click logic. `public/push-sw.js` itself is not modified.
- Precache hashed build assets (`CacheFirst`), fonts (`CacheFirst`), HTML navigations (`NetworkFirst` with a short timeout and an offline fallback document).
- Exclude `/api/*`, `/~oauth`, and Supabase/Twilio/Stripe origins from caching — no auth, message or call data is cached.

### Registration wrapper

New `src/lib/service-worker.ts` with a `registerAppServiceWorker()` called once from `src/routes/__root.tsx`. It refuses to register (and unregisters any existing `/sw.js`) when any is true:

- `!import.meta.env.PROD`
- inside an iframe
- hostname starts with `id-preview--` / `preview--`
- hostname is or ends with `lovableproject.com`, `lovableproject-dev.com`, `beta.lovable.dev`
- URL has `?sw=off` (kill switch)

### Push coexistence

Service worker registrations are keyed by scope, and both workers use `/`. To avoid one replacing the other:

- In production, `PUSH_SW_URL` resolves to `/sw.js` (which imports `push-sw.js`), so the existing push subscription carries over on the same root registration — no re-enable prompt for current users.
- In dev/preview, `PUSH_SW_URL` stays `/push-sw.js` so push testing keeps working where the offline worker is disabled.
- `src/lib/push.ts` picks the URL from that single constant; no other push code changes.

### Offline fallback route

Add a small offline fallback page served for navigations that miss the cache, styled with existing Midnight Dialer tokens, with a Retry button.

## Files

- `vite.config.ts` — add `VitePWA` alongside the existing events polyfill plugin.
- `src/lib/service-worker.ts` — new guarded registration wrapper.
- `src/lib/push-config.ts` — environment-aware `PUSH_SW_URL`.
- `src/routes/__root.tsx` — call the wrapper in an effect.
- `public/offline.html` — offline fallback document.
- `package.json` — add `vite-plugin-pwa`.

## Verification

Production build, then confirm `/sw.js` is emitted and contains the push handlers, the wrapper refuses registration in preview/iframe/`?sw=off`, and an offline navigation in a production-like context serves the shell.
