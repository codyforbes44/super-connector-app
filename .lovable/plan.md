# SixVox Google Play production deployment

The SixVox web app is already a complete PWA with manifest, icons, splash screens, offline shell, and push notifications. The next step is to wrap it as a Trusted Web Activity (TWA) and publish the Android package to Google Play.

## Goal

Ship a production-ready Android app on Google Play that opens SixVox in a TWA wrapper, preserving the current PWA install experience, offline support, and push notifications.

## Current readiness

| Requirement | Status |
|---|---|---|
| Web app manifest with `standalone`, icons, screenshots | Ready (`public/manifest.webmanifest`) |
| Offline app shell + service worker | Ready (`vite.config.ts` + `src/lib/service-worker.ts`) |
| Push notifications | Ready (`public/push-sw.js` imported by `/sw.js`) |
| Hosted privacy policy & terms | Ready (`/legal/privacy`, `/legal/terms`) |
| Custom domain for TWA host | Ready (`https://sixvox.3bi.io`) |
| Digital Asset Links (`/.well-known/assetlinks.json`) | Ready — SHA-256 fingerprint added and web project publishing in progress |
| Bubblewrap TWA manifest | Ready (`twa-manifest.json`) |
| Play Store listing assets | Ready (`.lovable/play-store-listing.md`) |

## Deployment sequence

```text
1. Create Google Play Console app → record package name (app.sixvox) and signing key SHA-256 ✓
2. Add .well-known/assetlinks.json to the web project with that fingerprint ✓
3. Publish the web project so sixvox.3bi.io serves the asset links file → in progress
4. Generate TWA Android package with Bubblewrap
5. Upload AAB to Play Console → internal testing → production
6. Submit data safety, content rating, and privacy policy
```

## Build the AAB with Bubblewrap

Prerequisites: Node.js 18+ and a local directory for the Android build output.

```bash
# 1. Install Bubblewrap globally (or use npx)
npm install -g @bubblewrap/cli

# 2. Create the Android project from the existing TWA manifest
bubblewrap build --manifest=twa-manifest.json

# 3. If you need to regenerate the manifest from the web app manifest first
bubblewrap init --manifest=https://sixvox.3bi.io/manifest.webmanifest

# 4. Build the Android App Bundle
bubblewrap build --skipPwaValidation
```

Expected output: `app.sixvox.aab` in the current directory.

Upload that file to Play Console in the internal testing release you already opened.

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
- Run a fresh security scan before promoting the release beyond internal testing.
