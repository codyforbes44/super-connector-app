import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowRight, ChevronDown, Menu, Radio, X } from "lucide-react";
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
  const [pastHero, setPastHero] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
      setPastHero(window.scrollY > 320);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the sheet whenever navigation happens, including back/forward.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock background scrolling while the mobile sheet is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

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

          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="inline-flex min-h-11 items-center rounded-full px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "text-foreground" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/auth"
              className="hidden min-h-11 items-center rounded-full px-4 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="key-call hidden min-h-11 items-center rounded-full px-4 text-sm font-semibold sm:inline-flex"
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
          <nav
            id="marketing-mobile-nav"
            aria-label="Mobile"
            className="fixed inset-x-0 top-[3.75rem] bottom-0 z-40 overflow-y-auto border-t border-border bg-background/97 px-5 pt-4 backdrop-blur-xl md:hidden"
          >
            <ul className="grid gap-1.5">
              {NAV.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className="surface-row flex min-h-14 items-center justify-between rounded-2xl px-4 text-base font-medium text-muted-foreground active:scale-[0.99]"
                    activeProps={{ className: "text-foreground border-primary/40" }}
                  >
                    {item.label}
                    <ChevronDown className="h-4 w-4 -rotate-90 opacity-50" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
            <div className="safe-bottom mt-4 grid gap-2 pb-6">
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                onClick={() => setOpen(false)}
                className="key-call flex min-h-14 items-center justify-center gap-2 rounded-full text-base font-semibold"
              >
                Start free trial
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                to="/auth"
                onClick={() => setOpen(false)}
                className="key-raised flex min-h-14 items-center justify-center rounded-full text-base font-semibold"
              >
                Sign in
              </Link>
            </div>
          </nav>
        ) : null}
      </header>

      <main id="main" className="pb-mobile-cta relative">
        {children}
      </main>

      {/* Thumb-reach conversion bar: phones only, once the hero has scrolled away. */}
      <div
        className={cn(
          "safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/92 px-4 pt-3 backdrop-blur-xl transition-transform duration-300 md:hidden",
          pastHero && !open ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="flex items-center gap-2">
          <Link
            to="/pricing"
            className="key-raised flex min-h-12 flex-1 items-center justify-center rounded-full text-sm font-semibold"
          >
            See pricing
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="key-call flex min-h-12 flex-[1.4] items-center justify-center gap-2 rounded-full text-sm font-semibold"
          >
            Start free
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>

      <footer className="relative mt-20 border-t border-border md:mt-24">
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
      <ul className="mt-2">
        {links.map((link) => (
          <li key={`${link.to}-${link.label}`}>
            <Link
              to={link.to}
              className="inline-flex min-h-10 items-center text-[0.8rem] text-muted-foreground transition-colors hover:text-foreground"
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
    <section className={cn("mx-auto max-w-6xl px-5 py-12 md:py-20", className)}>{children}</section>
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
    <dl className="glass-panel grid grid-cols-2 gap-px overflow-hidden rounded-3xl md:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="surface-subtle p-5 md:p-6">
          <dt className="sr-only">{stat.label}</dt>
          <dd>
            <span className="font-display block text-xl font-semibold text-primary sm:text-2xl">
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
        <details key={item.q} className="group px-5 py-1.5">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold">
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