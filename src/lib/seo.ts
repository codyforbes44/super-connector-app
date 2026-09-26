import { PLANS } from "@/lib/plans";

export const SITE_URL = "https://sixvox.3bi.io";

/** Fallback social card used by any page that doesn't supply its own image. */
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.jpg`;

type MetaEntry = Record<string, string>;

/**
 * Build a complete, self-referencing head() payload for a public page.
 * `image` must be an absolute https URL when provided.
 */
export function pageHead(options: {
  path: string;
  title: string;
  description: string;
  type?: "website" | "article" | "product";
  image?: string;
}): { meta: MetaEntry[]; links: MetaEntry[] } {
  const url = `${SITE_URL}${options.path}`;
  const image = options.image ?? DEFAULT_OG_IMAGE;
  const meta: MetaEntry[] = [
    { title: options.title },
    { name: "description", content: options.description },
    { property: "og:title", content: options.title },
    { property: "og:description", content: options.description },
    { property: "og:type", content: options.type ?? "website" },
    { property: "og:url", content: url },
    { property: "og:site_name", content: "SixVox" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: options.title },
    { name: "twitter:description", content: options.description },
    { property: "og:image", content: image },
    { name: "twitter:image", content: image },
  ];
  return { meta, links: [{ rel: "canonical", href: url }] };
}

export function organizationLd(description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "SixVox",
    url: SITE_URL,
    logo: `${SITE_URL}/icon-512.png`,
    description,
  };
}

export function softwareApplicationLd(description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "SixVox",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description,
    url: SITE_URL,
    offers: {
      "@type": "Offer",
      price: String(PLANS.find((plan) => plan.code === "solo")?.monthly ?? ""),
      priceCurrency: "USD",
      url: `${SITE_URL}/pricing`,
    },
  };
}

export function faqLd(items: Array<{ q: string; a: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

export function breadcrumbLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}
