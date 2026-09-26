# Best-in-class app icons and mobile media

Today SixVox ships one 512px icon reused for everything — home screen, maskable Android shape, Apple touch icon, and push notification badge — plus a single 1280x1024 social image used only on the homepage. That means clipped corners on Android, a washed-out notification badge, no iOS splash screens, and no install screenshots.

## What changes for users

- **Home screen icon** looks sharp and correctly shaped on iPhone (rounded square, no transparency), Android (full-bleed adaptive with proper safe zone), and desktop.
- **Notifications** show a crisp SixVox mark with a proper monochrome badge instead of a blurry shrunken logo.
- **Installing on Android/desktop** shows real app screenshots and a richer install card.
- **Launching the installed app on iOS** shows a branded Midnight Dialer splash instead of a white flash.
- **Sharing any page** produces a correctly sized 1200x630 preview card, not just on the homepage.
- **Offline page** and favicon match the same mark.

## Icon set to produce

All derived from the existing SixVox mark so branding stays identical.

| File                                           | Size                       | Purpose                                                                            |
| ---------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------- |
| `icon-192.png`, `icon-512.png`                 | 192, 512                   | manifest `any`                                                                     |
| `icon-maskable-512.png`                        | 512                        | manifest `maskable`, mark scaled to ~80% inside the safe circle on solid `#08131c` |
| `apple-touch-icon.png`                         | 180                        | iOS home screen, opaque background (iOS does not round transparency well)          |
| `favicon.png`                                  | 64                         | browser tab (regenerated from the same mark)                                       |
| `notification-badge.png`                       | 96                         | monochrome white-on-transparent glyph for the Android status bar                   |
| `og-default.jpg`                               | 1200x630                   | shared social card for all pages                                                   |
| `apple-splash-*.png`                           | 6 common iPhone/iPad sizes | iOS standalone launch screens                                                      |
| `screenshot-mobile.png`, `screenshot-wide.png` | 1080x1920, 1920x1080       | manifest install screenshots                                                       |

Images are generated from the existing mark composited on the app gradient, and stay in `public/` since manifests and service workers need literal paths.

## Wiring

- `public/manifest.webmanifest` — full `icons` array (192/512 any + maskable), `screenshots` with `form_factor` values; existing name, id, scope and shortcuts unchanged.
- `src/routes/__root.tsx` — `apple-touch-icon` at 180, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style: black-translucent`, `apple-mobile-web-app-title: SixVox`, `mobile-web-app-capable`, `apple-touch-startup-image` links with per-device media queries, and default `og:image` / `twitter:image` pointing at `og-default.jpg`.
- `src/lib/seo.ts` — default `image` to `og-default.jpg` when a page doesn't pass one, so every route gets a valid card.
- `public/push-sw.js` — `icon: "/icon-192.png"`, `badge: "/notification-badge.png"`.
- `public/offline.html` — use the regenerated favicon and mark.

## Technical notes

- Maskable icons need ~20% padding on all sides because Android crops to a circle/squircle; this is why a separate maskable asset is required instead of reusing the `any` icon.
- iOS caches `start_url`, `id`, `scope` and `display` at install time. None of those change, so no reinstall is forced; already-installed users pick up new icons on reinstall.
- The PWA service worker precache list picks up the new files automatically — no service-worker logic changes.
