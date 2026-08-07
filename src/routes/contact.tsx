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

const TITLE = "Contact Signalbox — talk to the team";
const DESCRIPTION =
  "Questions about plans, migrating your Twilio numbers, AI voicemail assistants or team rollout? Send the Signalbox team a message.";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", company: "", message: "" });

  const update = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await submitLead({ data: form });
      setSent(true);
      setForm({ name: "", email: "", company: "", message: "" });
      toast.success("Thanks — we'll be in touch shortly.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <MarketingLayout>
      <Section className="pb-8">
        <Eyebrow>We reply from bookme.bet</Eyebrow>
        <h1 className="font-display mt-5 text-4xl leading-[1.05] font-semibold md:text-5xl">
          Talk to the team
        </h1>
        <p className="mt-4 max-w-2xl text-[0.95rem] leading-relaxed text-muted-foreground">
          Migrating a busy Twilio account, rolling Signalbox out to a team, or curious what the AI
          assistants can handle? Tell us what you need.
        </p>
      </Section>

      <Section className="grid gap-4 py-4 md:grid-cols-[1.4fr_1fr]">
        <form onSubmit={submit} className="glass-panel space-y-4 rounded-3xl p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" required value={form.name} onChange={update("name")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={update("email")}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company">Company (optional)</Label>
            <Input id="company" value={form.company} onChange={update("company")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="message">How can we help?</Label>
            <Textarea id="message" rows={6} required value={form.message} onChange={update("message")} />
          </div>
          <Button type="submit" className="key-call w-full rounded-full" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
            Send message
          </Button>
          {sent ? (
            <p className="text-xs text-success">Message received — we&apos;ll reply by email.</p>
          ) : null}
        </form>

        <aside className="glass-panel h-fit rounded-3xl p-6">
          <span className="key-raised flex h-11 w-11 items-center justify-center rounded-full">
            <Mail className="h-[1.05rem] w-[1.05rem] text-primary" />
          </span>
          <h2 className="font-display mt-4 text-sm font-semibold">What happens next</h2>
          <ul className="mt-2 space-y-2 text-[0.82rem] leading-relaxed text-muted-foreground">
            <li>We read every message ourselves — no ticket queue.</li>
            <li>Expect a reply within one business day.</li>
            <li>Need it faster? Start free and we&apos;ll help you inside the app.</li>
          </ul>
        </aside>
      </Section>
    </MarketingLayout>
  );
}