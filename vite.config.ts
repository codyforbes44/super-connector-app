// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { fileURLToPath } from "node:url";

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
  plugins: [resolveEventsPolyfill],
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
