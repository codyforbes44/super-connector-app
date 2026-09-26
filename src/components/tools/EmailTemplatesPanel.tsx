import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/format";
import { listEmailTemplates, previewEmailTemplate, saveEmailTemplate } from "@/lib/tools.functions";

type Draft = {
  subject: string;
  eyebrow: string;
  headline: string;
  intro: string;
  outro: string;
  enabled: boolean;
};

const EMPTY: Draft = {
  subject: "",
  eyebrow: "",
  headline: "",
  intro: "",
  outro: "",
  enabled: false,
};

export function EmailTemplatesPanel() {
  const queryClient = useQueryClient();
  const [active, setActive] = useState("missed-call");
  const [draft, setDraft] = useState<Draft>(EMPTY);

  const templates = useQuery({
    queryKey: ["email-templates"],
    queryFn: () => listEmailTemplates(),
  });

  const entry = (templates.data ?? []).find((t) => t.template === active);

  useEffect(() => {
    const o = entry?.override;
    setDraft({
      subject: o?.subject ?? "",
      eyebrow: o?.eyebrow ?? "",
      headline: o?.headline ?? "",
      intro: o?.intro ?? "",
      outro: o?.outro ?? "",
      enabled: o?.enabled ?? false,
    });
  }, [active, entry?.override]);

  const preview = useQuery({
    queryKey: ["email-preview", active, draft],
    queryFn: () => previewEmailTemplate({ data: { template: active, draft } }),
  });

  const save = useMutation({
    mutationFn: () => saveEmailTemplate({ data: { template: active, ...draft } }),
    onSuccess: async () => {
      toast.success("Template copy saved");
      await queryClient.invalidateQueries({ queryKey: ["email-templates"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="space-y-4">
      <Select value={active} onValueChange={setActive}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(templates.data ?? []).map((t) => (
            <SelectItem key={t.template} value={t.template}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {entry && (
        <p className="px-1 text-xs text-muted-foreground">
          {entry.description}
          {entry.variables.length > 0 && (
            <>
              {" "}
              Variables:{" "}
              {entry.variables.map((v) => (
                <code key={v} className="mr-1 surface-track rounded px-1">{`{{${v}}}`}</code>
              ))}
            </>
          )}
        </p>
      )}

      <div className="glass-panel space-y-3 rounded-3xl p-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Use custom copy</Label>
          <Switch
            checked={draft.enabled}
            onCheckedChange={(enabled) => setDraft({ ...draft, enabled })}
          />
        </div>
        <div className="space-y-1">
          <Label>Subject</Label>
          <Input
            value={draft.subject}
            onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
            placeholder="Leave blank to keep the default"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label>Eyebrow</Label>
            <Input
              value={draft.eyebrow}
              onChange={(e) => setDraft({ ...draft, eyebrow: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Headline</Label>
            <Input
              value={draft.headline}
              onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Intro paragraph</Label>
          <Textarea
            rows={2}
            value={draft.intro}
            onChange={(e) => setDraft({ ...draft, intro: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label>Closing paragraph</Label>
          <Textarea
            rows={2}
            value={draft.outro}
            onChange={(e) => setDraft({ ...draft, outro: e.target.value })}
          />
        </div>
        <Button
          className="w-full rounded-full"
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <Save className="size-4" /> Save copy
            </>
          )}
        </Button>
      </div>

      <div className="space-y-2">
        <p className="flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Wand2 className="size-3.5" /> Live preview · {preview.data?.subject ?? ""}
        </p>
        {preview.isFetching && <Loader2 className="mx-auto size-4 animate-spin" />}
        {preview.data && (
          <iframe
            title="Template preview"
            className="h-[480px] w-full rounded-2xl border border-border bg-white"
            srcDoc={preview.data.html}
          />
        )}
      </div>
    </div>
  );
}
