# SixVox Google Play production deployment

The SixVox web app is already a complete PWA with manifest, icons, splash screens, offline shell, and push notifications. The next step is to wrap it as a Trusted Web Activity (TWA) and publish the Android package to Google Play.

## Goal

Ship a production-ready Android app on Google Play that opens SixVox in a TWA wrapper, preserving the current PWA install experience, offline support, and push notifications.

## Current readiness

| Requirement | Status |
|---|---|
| Web app manifest with `standalone`, icons, screenshots | Ready (`public/manifest.webmanifest`) |
| Offline app shell + service worker | Ready (`vite.config.ts` + `src/lib/service-worker.ts`) |
| Push notifications | Ready (`public/push-sw.js` imported by `/sw.js`) |
| Hosted privacy policy & terms | Ready (`/legal/privacy`, `/legal/terms`) |
| Custom domain for TWA host | Ready (`https://sixvox.3bi.io`) |
| Digital Asset Links (`/.well-known/assetlinks.json`) | **Missing — needs Play Console signing key fingerprint** |
| Bubblewrap TWA manifest | **Missing** |
| Play Store listing assets | **Missing — needs feature graphic + screenshots** |

## What we will build

1. **TWA configuration in the project** — `twa-manifest.json` for Bubblewrap targeting `sixvox.3bi.io` and package `app.sixvox`.
2. **Digital Asset Links** — `public/.well-known/assetlinks.json` that authorizes `app.sixvox` to open `https://sixvox.3bi.io`.
3. **Play Store listing summary** — a short description, full description, and feature graphic prompt for the listing.
4. **TWA build instructions** — exact Bubblewrap commands to generate the Android App Bundle (AAB) for Play Console.

## Deployment sequence

```text
1. Create Google Play Console app → record package name (app.sixvox) and signing key SHA-256
2. Add .well-known/assetlinks.json to the web project with that fingerprint
3. Publish the web project so sixvox.3bi.io serves the asset links file
4. Generate TWA Android package with Bubblewrap
5. Upload AAB to Play Console → internal testing → production
6. Submit data safety, content rating, and privacy policy
```

## Important: Google Play App Signing caveat

Because you chose Google Play App Signing, Google generates the final signing key. The `assetlinks.json` fingerprint must come from **Play Console → Setup → App signing → App signing key certificate → SHA-256 fingerprint**. This cannot be guessed in advance, so the plan will deliver the assetlinks file with a placeholder fingerprint that you replace after creating the Play Console entry.

## Files to add

| File | Purpose |
|---|---|
| `twa-manifest.json` | Bubblewrap input: package id, host, theme, launcher, features, signing flags |
| `public/.well-known/assetlinks.json` | Proves domain ownership for TWA verification |
| `.lovable/play-store-listing.md` | Title, short description, full description, feature graphic prompt |

## TWA manifest details

- `packageId`: `app.sixvox`
- `host`: `sixvox.3bi.io`
- `name`: `SixVox`
- `launcherName`: `SixVox`
- `display`: `standalone`
- `themeColor` / `backgroundColor`: `#08131c`
- `enableNotifications`: `true` (keeps push working)
- `shortcuts`: Inbox (`/inbox`), Dialer (`/calls`)
- `signingMode`: `none` in Bubblewrap config; Play Console handles signing
- `fallbackType`: `customtabs` (Chrome Custom Tab if TWA validation fails)

## Verification before submission

- `https://sixvox.3bi.io/.well-known/assetlinks.json` returns valid JSON and HTTP 200.
- Chrome DevTools "Digital Asset Links" validation passes for `app.sixvox` / `sixvox.3bi.io`.
- Bubblewrap build succeeds and produces an AAB.
- Internal testing track installs the app, opens SixVox, and receives push notifications.

## Notes

- The existing web app remains the source of truth; the TWA is a thin wrapper. No web functionality changes.
- Keep the existing PWA service worker guards so preview/dev hosts never register `/sw.js`.
- Play Store review may require an in-app account for testing. The super-admin account (codyforbes@gmail.com) can be used.
- The store listing must disclose that SixVox is a communication app that handles phone calls, SMS, and notifications.
