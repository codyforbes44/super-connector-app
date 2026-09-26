import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Mail, MessageSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Eyebrow, MarketingLayout, Section } from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/format";
import { submitLead } from "@/lib/payments.functions";
import { SITE_URL, breadcrumbLd, pageHead } from "@/lib/seo";

const TITLE = "Contact SixVox — talk to the team";
const DESCRIPTION =
  "Questions about plans, moving your existing numbers, the AI receptionist or team rollout? Send the SixVox team a message.";

export const Route = createFileRoute("/contact")({
  head: () => ({
    ...pageHead({
      path: "/contact",
      title: TITLE,
      description: DESCRIPTION,
      image: `${SITE_URL}/og-contact.jpg`,
    }),
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Contact", path: "/contact" },
          ]),
        ),
      },
    ],
  }),
  component: ContactPage,
});

const TOPICS = [
  { value: "sales", label: "Plans & pricing" },
  { value: "porting", label: "Moving my numbers" },
  { value: "support", label: "Billing or account help" },
  { value: "other", label: "Something else" },
] as const;

function ContactPage() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [topic, setTopic] = useState<(typeof TOPICS)[number]["value"]>("sales");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ name: "", email: "", company: "", message: "" });

  const update = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const validate = () => {
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next["name"] = "Please enter your name.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim()))
      next["email"] = "Please enter a valid email address.";
    if (form.message.trim().length < 10) next["message"] = "Please tell us a little more.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      const label = TOPICS.find((item) => item.value === topic)?.label ?? "Enquiry";
      await submitLead({ data: { ...form, message: `[${label}] ${form.message}` } });
      setSent(true);
      setForm({ name: "", email: "", company: "", message: "" });
      toast.success("Thanks — we'll be in touch shortly.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <MarketingLayout>
        <Section className="py-16">
          <div className="glass-panel mx-auto max-w-xl rounded-[2rem] p-8 text-center">
            <span className="key-signal mx-auto flex h-14 w-14 items-center justify-center rounded-xl">
              <Mail className="h-5 w-5 text-primary" />
            </span>
            <h1 className="font-display mt-5 text-2xl font-semibold">Message received</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              A real person reads every message. Expect a reply by email within one business day.
            </p>
            <Button
              variant="secondary"
              className="mt-6 rounded-full"
              onClick={() => setSent(false)}
            >
              Send another message
            </Button>
          </div>
        </Section>
      </MarketingLayout>
    );
  }

  return (
    <MarketingLayout>
      <Section className="pb-8">
        <Eyebrow>A person replies, usually same day</Eyebrow>
        <h1 className="font-display mt-5 text-[2rem] leading-[1.06] font-semibold text-balance sm:text-4xl md:text-5xl">
          Talk to the team
        </h1>
        <p className="mt-4 max-w-2xl text-[0.95rem] leading-relaxed text-muted-foreground">
          Moving a busy business line, rolling SixVox out to a team, or curious what the AI
          assistants can handle? Tell us what you need.
        </p>
      </Section>

      <Section className="grid gap-4 py-4 md:grid-cols-[1.4fr_1fr]">
        <form onSubmit={submit} className="glass-panel space-y-4 rounded-3xl p-6">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">What&apos;s this about?</legend>
            <div className="flex flex-wrap gap-2">
              {TOPICS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={topic === item.value}
                  onClick={() => setTopic(item.value)}
                  className={
                    topic === item.value
                      ? "key-signal min-h-11 rounded-xl px-4 text-xs font-semibold text-primary-foreground"
                      : "surface-row min-h-11 rounded-xl px-4 text-xs font-semibold text-muted-foreground"
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                className="h-12 text-base"
                required
                autoComplete="name"
                aria-invalid={Boolean(errors["name"])}
                aria-describedby={errors["name"] ? "name-error" : undefined}
                value={form.name}
                onChange={update("name")}
              />
              {errors["name"] ? (
                <p id="name-error" className="text-xs text-destructive">
                  {errors["name"]}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                className="h-12 text-base"
                type="email"
                required
                inputMode="email"
                autoComplete="email"
                spellCheck={false}
                aria-invalid={Boolean(errors["email"])}
                aria-describedby={errors["email"] ? "email-error" : undefined}
                value={form.email}
                onChange={update("email")}
              />
              {errors["email"] ? (
                <p id="email-error" className="text-xs text-destructive">
                  {errors["email"]}
                </p>
              ) : null}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company">Company (optional)</Label>
            <Input
              id="company"
              className="h-12 text-base"
              autoComplete="organization"
              value={form.company}
              onChange={update("company")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="message">How can we help?</Label>
            <Textarea
              id="message"
              className="min-h-40 text-base"
              rows={6}
              required
              aria-invalid={Boolean(errors["message"])}
              aria-describedby={errors["message"] ? "message-error" : undefined}
              value={form.message}
              onChange={update("message")}
            />
            {errors["message"] ? (
              <p id="message-error" className="text-xs text-destructive">
                {errors["message"]}
              </p>
            ) : null}
          </div>
          <Button type="submit" className="key-signal min-h-12 w-full rounded-xl" disabled={busy}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageSquare className="h-4 w-4" />
            )}
            Send message
          </Button>
          <p aria-live="polite" className="sr-only">
            {busy
              ? "Sending your message."
              : Object.keys(errors).length > 0
                ? "The form has errors. Please review the highlighted fields."
                : ""}
          </p>
        </form>

        <aside className="glass-panel h-fit rounded-3xl p-6">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/18 text-primary">
            <Mail className="size-[1.1rem]" />
          </span>
          <h2 className="font-display mt-4 text-sm font-semibold">What happens next</h2>
          <ul className="mt-2 space-y-2 text-[0.82rem] leading-relaxed text-muted-foreground">
            <li>We read every message ourselves — no ticket queue.</li>
            <li>Expect a reply within one business day.</li>
            <li>Need it faster? Start free and we&apos;ll help you inside the app.</li>
            <li>Already a subscriber? Billing questions get priority.</li>
          </ul>
        </aside>
      </Section>
    </MarketingLayout>
  );
}
