import type { ReactNode } from "react";

import { MarketingLayout, Section } from "@/components/MarketingLayout";

export const LEGAL_UPDATED = "26 September 2026";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <MarketingLayout>
      <Section className="py-12 md:py-20">
        <h1 className="font-display text-3xl font-semibold md:text-4xl">{title}</h1>
        <p className="mt-2 text-xs text-muted-foreground">Last updated {updated}</p>
        <div className="legal-prose mt-8 max-w-2xl space-y-4 text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
      </Section>
    </MarketingLayout>
  );
}
