import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowRight, ChevronDown, Menu, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import logoMark from "@/assets/sixvox-logo.png?w=72&format=webp";
import logoMarkSrcSet from "@/assets/sixvox-logo.png?w=36;72;108&format=webp&as=srcset";
import { cn } from "@/lib/utils";
import { AccountActions } from "@/components/AccountMenu";
import { useSession } from "@/hooks/useSession";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV = [
  { to: "/features", label: "Features" },
  { to: "/use-cases", label: "Use Cases" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/pricing", label: "Pricing" },
  { to: "/faq", label: "FAQ" },
  { to: "/contact", label: "Contact" },
] as const;

export function MarketingLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [pastHero, setPastHero] = useState(false);
  const { status } = useSession();
  const signedIn = status === "signedIn";
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);

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

  // Lock background scrolling while the sheet is open, without layout shift:
  // hiding the scrollbar would otherwise widen the page by its width.
  useEffect(() => {
    if (!open) return;
    const { body, documentElement } = document;
    const gutter = window.innerWidth - documentElement.clientWidth;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;
    body.style.overflow = "hidden";
    if (gutter > 0) body.style.paddingRight = `${gutter}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
    };
  }, [open]);

  // Move focus into the sheet, keep Tab inside it, and hand focus back to the
  // toggle on close — the standard dialog contract for a full-screen menu.
  useEffect(() => {
    if (!open) return;
    const sheet = sheetRef.current;
    if (!sheet) return;
    const focusables = () =>
      Array.from(
        sheet.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'),
      ).filter((el) => el.offsetParent !== null);

    focusables()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !sheet.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    sheet.addEventListener("keydown", onKeyDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      sheet.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keydown", onKeyDown);
      toggleRef.current?.focus();
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
      {/* Decorative glows, clipped to the shell so they can never widen the page. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 right-[-10%] h-[28rem] w-[28rem] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-[45rem] left-[-15%] h-[26rem] w-[26rem] rounded-full bg-primary/8 blur-3xl" />
      </div>

      {/* Detached, floating pill chrome — matches the in-app header language. */}
      <header className="sticky top-0 z-40 px-3 pt-2 pb-1 transition-all duration-300 sm:px-5 sm:pt-3">
        <div
          className={cn(
            "mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-full px-3 py-2 transition-all duration-300 sm:gap-4 sm:px-4",
            scrolled
              ? "glass-panel shadow-lg backdrop-blur-xl"
              : "border border-transparent bg-background/30 backdrop-blur-md",
          )}
        >
          <Link to="/" aria-label="SixVox home" className="flex min-h-11 items-center gap-2">
            <img
              src={logoMark}
              srcSet={logoMarkSrcSet}
              sizes="36px"
              alt="SixVox logo"
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
            />
            <span className="font-display text-base font-semibold tracking-tight">SixVox</span>
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "text-foreground" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <AccountActions />
            <button
              type="button"
              ref={toggleRef}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="marketing-mobile-nav"
              onClick={() => setOpen((value) => !value)}
              className="surface-row flex h-11 w-11 items-center justify-center rounded-xl md:hidden"
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

      </header>

      {/* Full-height mobile sheet. Kept outside the blurred header so it is not
          trapped by the header's backdrop-filter containing block. */}
      {open ? (
        <div
          id="marketing-mobile-nav"
          ref={sheetRef}
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          className="fixed inset-0 top-[4.25rem] z-50 overflow-y-auto overscroll-contain bg-background px-4 pt-3 [scrollbar-gutter:stable] md:hidden"
        >
          <nav aria-label="Mobile">
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
          </nav>
          <div className="safe-bottom mt-4 grid gap-2 pb-6">
            <AccountActions stacked />
          </div>
        </div>
      ) : null}

      <main id="main" className="pb-mobile-cta relative">
        {children}
      </main>

      {/* Thumb-reach conversion bar: phones only, once the hero has scrolled away. */}
      <div
        className={cn(
          "safe-bottom fixed inset-x-0 bottom-0 z-30 px-3 pt-3 transition-transform duration-300 md:hidden",
          pastHero && !open && pathname !== "/contact" ? "translate-y-0" : "translate-y-[130%]",
        )}
      >
        <div className="glass-panel flex items-center gap-2 rounded-full p-1.5 backdrop-blur-xl">
          {signedIn ? (
            <Link
              to="/pricing"
              className="surface-row flex min-h-12 flex-1 items-center justify-center rounded-xl text-sm font-semibold"
            >
              See pricing
            </Link>
          ) : pathname === "/pricing" ? (
            <Link
              to="/auth"
              search={{ mode: "signin" }}
              className="surface-row flex min-h-12 flex-1 items-center justify-center rounded-xl text-sm font-semibold"
            >
              Sign in
            </Link>
          ) : (
            <Link
              to="/pricing"
              className="surface-row flex min-h-12 flex-1 items-center justify-center rounded-xl text-sm font-semibold"
            >
              See pricing
            </Link>
          )}
          {signedIn ? (
            <Link
              to="/inbox"
              className="key-signal flex min-h-12 flex-[1.4] items-center justify-center gap-2 rounded-xl text-sm font-semibold"
            >
              Open app
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="key-signal flex min-h-12 flex-[1.4] items-center justify-center gap-2 rounded-xl text-sm font-semibold"
            >
              Start free
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          )}
        </div>
      </div>

      <footer className="relative mt-20 border-t border-border/60 md:mt-24">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <img
                src={logoMark}
                srcSet={logoMarkSrcSet}
                sizes="32px"
                alt="SixVox logo"
                width={32}
                height={32}
                loading="lazy"
                className="h-8 w-8 object-contain"
              />
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
              { to: "/use-cases", label: "Use Cases" },
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
              className="inline-flex min-h-11 items-center text-[0.82rem] text-muted-foreground transition-colors hover:text-foreground"
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
    <span className="surface-row inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground">
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
    <dl className="glass-panel grid grid-cols-2 divide-x divide-y divide-border/60 overflow-hidden rounded-3xl md:grid-cols-4 md:divide-y-0">
      {stats.map((stat) => (
        <div key={stat.label} className="p-5 md:p-6">
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
        className="key-signal inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-sm font-semibold md:w-auto"
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
          <p className="mt-1 pb-4 text-[0.85rem] leading-relaxed text-muted-foreground">{item.a}</p>
        </details>
      ))}
    </div>
  );
}