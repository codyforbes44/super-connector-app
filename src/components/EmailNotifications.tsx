import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Loader2, MailCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { errorMessage } from "@/lib/format";
import {
  getIntegrationStatus,
  getNotificationPrefs,
  saveNotificationPrefs,
  sendTestEmail,
} from "@/lib/integrations.functions";

type Toggle = {
  key:
    | "email_missed_call"
    | "email_voicemail"
    | "email_inbound_message"
    | "email_ai_summary"
    | "email_account";
  label: string;
};

const TOGGLES: Toggle[] = [
  { key: "email_missed_call", label: "Missed calls" },
  { key: "email_voicemail", label: "Voicemails" },
  { key: "email_inbound_message", label: "Inbound messages" },
  { key: "email_ai_summary", label: "AI call summaries" },
  { key: "email_account", label: "Account & billing alerts" },
];

type FormState = Record<string, unknown> & {
  email_address: string;
  quiet_hours_enabled: boolean;
  quiet_start: string;
  quiet_end: string;
  timezone: string;
};

export function EmailNotifications() {
  const qc = useQueryClient();
  const prefs = useQuery({ queryKey: ["notif-prefs"], queryFn: () => getNotificationPrefs() });
  const status = useQuery({ queryKey: ["integration-status"], queryFn: () => getIntegrationStatus() });

  const [form, setForm] = useState<FormState>({
    email_address: "",
    quiet_hours_enabled: false,
    quiet_start: "22:00",
    quiet_end: "07:00",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    email_missed_call: true,
    email_voicemail: true,
    email_inbound_message: true,
    email_ai_summary: true,
    email_account: true,
  });

  useEffect(() => {
    const row = prefs.data?.prefs as Record<string, unknown> | null | undefined;
    if (!row) {
      if (prefs.data?.fallbackEmail) {
        setForm((f) => ({ ...f, email_address: prefs.data.fallbackEmail as string }));
      }
      return;
    }
    setForm((f) => ({
      ...f,
      ...row,
      email_address: (row["email_address"] as string) || prefs.data?.fallbackEmail || "",
      quiet_start: ((row["quiet_start"] as string) || "22:00").slice(0, 5),
      quiet_end: ((row["quiet_end"] as string) || "07:00").slice(0, 5),
    }));
  }, [prefs.data]);

  const save = useMutation({
    mutationFn: () =>
      saveNotificationPrefs({
        data: {
          email_address: form.email_address || null,
          email_missed_call: Boolean(form["email_missed_call"]),
          email_voicemail: Boolean(form["email_voicemail"]),
          email_inbound_message: Boolean(form["email_inbound_message"]),
          email_ai_summary: Boolean(form["email_ai_summary"]),
          email_account: Boolean(form["email_account"]),
          quiet_hours_enabled: form.quiet_hours_enabled,
          quiet_start: form.quiet_start,
          quiet_end: form.quiet_end,
          timezone: form.timezone,
        },
      }),
    onSuccess: () => {
      toast.success("Email alerts updated");
      void qc.invalidateQueries({ queryKey: ["notif-prefs"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const test = useMutation({
    mutationFn: () => sendTestEmail({ data: { to: form.email_address } }),
    onSuccess: (res) => toast.success(`Test email sent to ${res.to}`),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const email = status.data?.email;

  return (
    <div className="glass-panel space-y-4 rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-medium">
          <BellRing className="size-4" /> Email alerts
        </p>
        <span className="text-[11px] text-muted-foreground">
          {email
            ? email.verified
              ? `${email.domain} verified`
              : `${email.domain} · ${email.domainStatus}`
            : "checking…"}
        </span>
      </div>

      <div className="space-y-1">
        <Label>Send alerts to</Label>
        <Input
          value={form.email_address}
          onChange={(e) => setForm({ ...form, email_address: e.target.value })}
          placeholder="you@example.com"
        />
      </div>

      <div className="space-y-2">
        {TOGGLES.map((t) => (
          <div key={t.key} className="flex items-center justify-between">
            <span className="text-sm">{t.label}</span>
            <Switch
              checked={Boolean(form[t.key])}
              onCheckedChange={(v) => setForm({ ...form, [t.key]: v })}
            />
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t border-white/5 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-sm">Quiet hours</span>
          <Switch
            checked={form.quiet_hours_enabled}
            onCheckedChange={(v) => setForm({ ...form, quiet_hours_enabled: v })}
          />
        </div>
        {form.quiet_hours_enabled && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>From</Label>
              <Input
                type="time"
                value={form.quiet_start}
                onChange={(e) => setForm({ ...form, quiet_start: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>To</Label>
              <Input
                type="time"
                value={form.quiet_end}
                onChange={(e) => setForm({ ...form, quiet_end: e.target.value })}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button className="flex-1" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : "Save"}
        </Button>
        <Button
          variant="secondary"
          disabled={test.isPending || !form.email_address}
          onClick={() => test.mutate()}
        >
          {test.isPending ? <Loader2 className="size-4 animate-spin" /> : <MailCheck className="size-4" />}
        </Button>
      </div>
    </div>
  );
}