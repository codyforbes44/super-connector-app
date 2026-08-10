export const SITE_URL = "https://sixvox.3bi.io";

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
  ];
  if (options.image) {
    meta.push(
      { property: "og:image", content: options.image },
      { name: "twitter:image", content: options.image },
    );
  }
  return { meta, links: [{ rel: "canonical", href: url }] };
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