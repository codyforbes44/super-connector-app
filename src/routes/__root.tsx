import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { registerAppServiceWorker } from "@/lib/service-worker";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { handleE911AuthEvent } from "@/lib/compliance/e911-session";
import { primeSessionPersistence, startSessionKeeper } from "@/lib/session-keeper";

// Must run before the lazy Supabase client first reads persisted storage.
primeSessionPersistence();

/** iOS standalone launch images, keyed by device logical size + pixel ratio. */
const appleSplashLinks = (
  [
    [1290, 2796, 430, 932, 3],
    [1179, 2556, 393, 852, 3],
    [1284, 2778, 428, 926, 3],
    [1170, 2532, 390, 844, 3],
    [1125, 2436, 375, 812, 3],
    [1668, 2388, 834, 1194, 2],
    [2048, 2732, 1024, 1366, 2],
    [1536, 2048, 768, 1024, 2],
    [1620, 2160, 810, 1080, 2],
    [1668, 2224, 834, 1112, 2],
    [828, 1792, 414, 896, 2],
    [750, 1334, 375, 667, 2],
  ] as const
).map(([w, h, cssW, cssH, dpr]) => ({
  rel: "apple-touch-startup-image",
  href: `/apple-splash-${w}x${h}.png`,
  media: `(device-width: ${cssW}px) and (device-height: ${cssH}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`,
}));

/** Landscape counterparts (Safari standalone rotated launch). */
const appleSplashLandscapeLinks = (
  [
    [2796, 1290, 430, 932, 3],
    [2556, 1179, 393, 852, 3],
    [2436, 1125, 375, 812, 3],
    [2732, 2048, 1024, 1366, 2],
  ] as const
).map(([w, h, cssW, cssH, dpr]) => ({
  rel: "apple-touch-startup-image",
  href: `/apple-splash-${w}x${h}.png`,
  media: `(device-width: ${cssW}px) and (device-height: ${cssH}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: landscape)`,
}));

/** Generic launch artwork used by Chrome Android / Firefox install + offline shells. */
const webSplashLinks = [
  { rel: "preload", as: "image", href: "/splash-portrait.png", media: "(orientation: portrait)" },
  { rel: "preload", as: "image", href: "/splash-landscape.png", media: "(orientation: landscape)" },
];

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Try again
          </Button>
          <a
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: "SixVox — business calls, texts and AI receptionist" },
      {
        name: "description",
        content:
          "Run your business number, inbox, calls and AI receptionist from one mobile app built for teams.",
      },
      { name: "theme-color", content: "#0C1017" },
      { name: "color-scheme", content: "dark light" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "SixVox" },
      { name: "application-name", content: "SixVox" },
      { name: "msapplication-TileColor", content: "#0C1017" },
      { name: "msapplication-TileImage", content: "/favicon-192x192.png" },
      { name: "msapplication-config", content: "/browserconfig.xml" },
      { property: "og:title", content: "SixVox — business calls, texts and AI receptionist" },
      {
        property: "og:description",
        content:
          "Run your business number, inbox, calls and AI receptionist from one mobile app built for teams.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Outfit:wght@500;600;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png" },
      { rel: "icon", type: "image/png", sizes: "48x48", href: "/favicon-48x48.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/favicon-192x192.png" },
      { rel: "icon", type: "image/x-icon", sizes: "any", href: "/favicon.ico" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "apple-touch-icon", sizes: "167x167", href: "/apple-touch-icon-167.png" },
      { rel: "apple-touch-icon", sizes: "152x152", href: "/apple-touch-icon-152.png" },
      { rel: "apple-touch-icon", sizes: "120x120", href: "/apple-touch-icon-120.png" },
      ...appleSplashLinks,
      ...appleSplashLandscapeLinks,
      ...webSplashLinks,
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    void registerAppServiceWorker();
  }, []);

  // Keeps the access token fresh (wake-ups, bfcache, reconnects) and honours
  // the "Remember me" choice for where the session is stored.
  useEffect(() => startSessionKeeper(), []);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      handleE911AuthEvent(event);
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
