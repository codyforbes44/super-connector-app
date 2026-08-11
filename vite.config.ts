// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { fileURLToPath } from "node:url";
import { VitePWA } from "vite-plugin-pwa";
import { imagetools } from "vite-imagetools";

const eventsShim = fileURLToPath(new URL("./node_modules/events/events.js", import.meta.url));

// The Twilio Voice SDK does `class X extends require("events").EventEmitter`.
// In the browser build "events" otherwise resolves to an empty node-builtin
// stub, so EventEmitter is undefined and in-app calling dies with
// "superclass is not a constructor". Force it to the real npm polyfill.
const resolveEventsPolyfill = {
  name: "resolve-events-polyfill",
  enforce: "pre" as const,
  resolveId(source: string) {
    if (source === "events" || source === "node:events") return eventsShim;
    return null;
  },
};

export default defineConfig({
  plugins: [
    resolveEventsPolyfill,
    // Build-time responsive variants: `?w=...&format=webp&as=srcset`.
    imagetools(),
    // Offline app shell for installed PWAs. Registration is gated by
    // src/lib/service-worker.ts — never in dev or Lovable preview.
    VitePWA({
      strategies: "generateSW",
      registerType: "autoUpdate",
      injectRegister: null,
      filename: "sw.js",
      // The client build (what the CDN serves) lands in dist/client.
      outDir: "dist/client",
      // We ship our own public/manifest.webmanifest.
      manifest: false,
      devOptions: { enabled: false },
      workbox: {
        // Keep all push/call notification logic in the single root-scope worker.
        importScripts: ["/push-sw.js"],
        globPatterns: ["**/*.{js,css,woff,woff2,png,svg,ico}"],
        globIgnores: ["**/push-sw.js", "**/_server/**", "**/server/**"],
        navigateFallback: "/offline.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/~oauth/, /^\/sitemap\.xml$/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ request, url }: { request: Request; url: URL }) =>
              request.mode === "navigate" &&
              !url.pathname.startsWith("/api/") &&
              !url.pathname.startsWith("/~oauth"),
            handler: "NetworkFirst",
            options: {
              cacheName: "sixvox-pages",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            urlPattern: ({ url, sameOrigin }: { url: URL; sameOrigin: boolean }) =>
              sameOrigin && /\.(?:js|css|woff2?|png|svg|ico)$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "sixvox-assets",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: ({ url }: { url: URL }) =>
              url.origin === "https://fonts.googleapis.com" ||
              url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "sixvox-fonts",
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
