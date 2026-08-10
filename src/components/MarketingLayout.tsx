import { Link } from "@tanstack/react-router";
import { ArrowRight, Menu, Radio, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const NAV = [
  { to: "/features", label: "Features" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/pricing", label: "Pricing" },
  { to: "/faq", label: "FAQ" },
  { to: "/contact", label: "Contact" },
] as const;

export function MarketingLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app-gradient relative min-h-dvh w-full overflow-x-hidden">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 right-[-10%] h-[28rem] w-[28rem] rounded-full bg-primary/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[45rem] left-[-15%] h-[26rem] w-[26rem] rounded-full bg-success/15 blur-3xl"
      />

      <header
        className={cn(
          "sticky top-0 z-40 border-b transition-colors duration-300",
          scrolled
            ? "border-border bg-background/85 backdrop-blur-xl"
            : "border-transparent bg-background/40 backdrop-blur-md",
        )}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="key-signal flex h-9 w-9 items-center justify-center rounded-full">
              <Radio className="h-4 w-4" />
            </span>
            <span className="font-display text-base font-semibold tracking-tight">SixVox</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-full px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "text-foreground" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/auth"
              className="hidden rounded-full px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              to="/auth"
              aria-expanded={undefined}
              search={{ mode: "signup" }}
              className="key-call inline-flex items-center rounded-full px-4 py-2.5 text-sm font-semibold"
            >
              Start free
            </Link>
            <button
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="marketing-mobile-nav"
              onClick={() => setOpen((value) => !value)}
              className="key-raised flex h-11 w-11 items-center justify-center rounded-full md:hidden"
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {open ? (
          <nav id="marketing-mobile-nav" className="border-t border-border px-5 py-3 md:hidden">
            <ul className="grid gap-1">
              {NAV.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className="block rounded-2xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              to="/auth"
              onClick={() => setOpen(false)}
              className="mt-2 block rounded-2xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent/40 hover:text-foreground"
            >
              Sign in
            </Link>
          </nav>
        ) : null}
      </header>

      <main id="main" className="relative">
        {children}
      </main>

      <footer className="relative mt-24 border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="key-signal flex h-8 w-8 items-center justify-center rounded-full">
                <Radio className="h-3.5 w-3.5" />
              </span>
              <span className="font-display text-sm font-semibold">SixVox</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Business calls, texts, WhatsApp, voicemail and an AI receptionist — in one
              mobile app.
            </p>
          </div>
          <FooterCol
            title="Product"
            links={[
              { to: "/features", label: "Features" },
              { to: "/how-it-works", label: "How it works" },
              { to: "/pricing", label: "Pricing" },
            ]}
          />
          <FooterCol
            title="Company"
            links={[
              { to: "/faq", label: "FAQ" },
              { to: "/contact", label: "Contact" },
              { to: "/legal/privacy", label: "Privacy" },
              { to: "/legal/terms", label: "Terms" },
            ]}
          />
          <FooterCol
            title="Account & support"
            links={[
              { to: "/auth", label: "Sign in" },
              { to: "/auth", label: "Create account" },
              { to: "/contact", label: "Billing support" },
              { to: "/pricing", label: "Plans & billing terms" },
            ]}
          />
        </div>
        <div className="mx-auto max-w-6xl space-y-2 px-5 pb-10 text-xs text-muted-foreground">
          <p>
            Prices are shown in USD. Applicable sales tax or VAT is calculated at checkout.
            Subscriptions renew automatically until cancelled.
          </p>
          <p>© {new Date().getFullYear()} SixVox. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: Array<{ to: string; label: string }>;
}) {
  return (
    <div>
      <p className="font-display text-xs font-semibold tracking-wide uppercase">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={`${link.to}-${link.label}`}>
            <Link
              to={link.to}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Section({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mx-auto max-w-6xl px-5 py-16 md:py-24", className)}>{children}</section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="glass-panel inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-success" />
      {children}
    </span>
  );
}

export function StatBand({
  stats,
}: {
  stats: Array<{ value: string; label: string }>;
}) {
  return (
    <dl className="glass-panel grid grid-cols-2 gap-6 rounded-3xl p-6 md:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label}>
          <dt className="sr-only">{stat.label}</dt>
          <dd>
            <span className="font-display block text-2xl font-semibold text-primary">
              {stat.value}
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
              {stat.label}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function CtaBand({
  title,
  body,
  label = "Start free trial",
  note,
}: {
  title: string;
  body: string;
  label?: string;
  note?: string;
}) {
  return (
    <div className="glass-panel flex flex-col items-start gap-4 rounded-[2rem] p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">{body}</p>
        {note ? <p className="mt-2 text-xs text-muted-foreground">{note}</p> : null}
      </div>
      <Link
        to="/auth"
        search={{ mode: "signup" }}
        className="key-call inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-sm font-semibold md:w-auto"
      >
        {label}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

export function FaqAccordion({ items }: { items: Array<{ q: string; a: string }> }) {
  return (
    <div className="glass-panel divide-y divide-border overflow-hidden rounded-3xl">
      {items.map((item) => (
        <details key={item.q} className="group px-5 py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold">
            {item.q}
            <span
              aria-hidden
              className="text-muted-foreground transition-transform group-open:rotate-45 motion-reduce:transition-none"
            >
              +
            </span>
          </summary>
          <p className="mt-2 text-[0.85rem] leading-relaxed text-muted-foreground">{item.a}</p>
        </details>
      ))}
    </div>
  );
}