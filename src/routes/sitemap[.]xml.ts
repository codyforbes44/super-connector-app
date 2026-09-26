import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { TRADES } from "@/lib/trades";

const BASE_URL = "https://sixvox.3bi.io";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/features", changefreq: "weekly", priority: "0.8" },
          { path: "/how-it-works", changefreq: "weekly", priority: "0.8" },
          { path: "/pricing", changefreq: "weekly", priority: "0.8" },
          { path: "/use-cases", changefreq: "weekly", priority: "0.8" },
          { path: "/contact", changefreq: "monthly", priority: "0.6" },
          { path: "/faq", changefreq: "monthly", priority: "0.6" },
          { path: "/compare", changefreq: "weekly", priority: "0.8" },
          { path: "/developers/webhooks", changefreq: "monthly", priority: "0.5" },
          ...TRADES.map((trade) => ({
            path: `/for/${trade.slug}`,
            changefreq: "monthly" as const,
            priority: "0.7",
          })),
          { path: "/legal/privacy", changefreq: "monthly", priority: "0.3" },
          { path: "/legal/terms", changefreq: "monthly", priority: "0.3" },
        ];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
