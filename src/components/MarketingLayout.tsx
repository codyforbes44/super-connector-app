import { Link } from "@tanstack/react-router";
import { Menu, Radio, X } from "lucide-react";
import { useState, type ReactNode } from "react";

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

  return (
    <div className="app-gradient relative min-h-dvh w-full overflow-x-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 right-[-10%] h-[28rem] w-[28rem] rounded-full bg-primary/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[45rem] left-[-15%] h-[26rem] w-[26rem] rounded-full bg-success/15 blur-3xl"
      />

      <header className="sticky top-0 z-40 border-b border-border bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="key-signal flex h-9 w-9 items-center justify-center rounded-full">
              <Radio className="h-4 w-4 text-primary" />
            </span>
            <span className="font-display text-base font-semibold tracking-tight">SignalBox</span>
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
              search={{ mode: "signup" }}
              className="key-call inline-flex items-center rounded-full px-4 py-2.5 text-sm font-semibold"
            >
              Start free
            </Link>
            <button
              type="button"
              aria-label="Menu"
              onClick={() => setOpen((value) => !value)}
              className="key-raised flex h-9 w-9 items-center justify-center rounded-full md:hidden"
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {open ? (
          <nav className="border-t border-border px-5 py-3 md:hidden">
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

      <main className="relative">{children}</main>

      <footer className="relative mt-24 border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="key-signal flex h-8 w-8 items-center justify-center rounded-full">
                <Radio className="h-3.5 w-3.5 text-primary" />
              </span>
              <span className="font-display text-sm font-semibold">SignalBox</span>
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
            title="Account"
            links={[
              { to: "/auth", label: "Sign in" },
              { to: "/auth", label: "Create account" },
            ]}
          />
        </div>
        <div className="mx-auto max-w-6xl px-5 pb-10 text-xs text-muted-foreground">
          © {new Date().getFullYear()} SignalBox. All rights reserved.
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