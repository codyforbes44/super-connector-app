import { useMutation } from "@tanstack/react-query";
import { FileUp, Loader2, Upload } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_IMPORT_CHARS,
  MAX_IMPORT_ROWS,
  type ContactImportPreview,
  type ImportHint,
} from "@/lib/contact-import";
import { commitContactImport, previewContactImport } from "@/lib/contacts.functions";
import { errorMessage, formatPhone } from "@/lib/format";

type ImportResult = {
  created: number;
  skippedInvalid: number;
  skippedDuplicate: number;
};

type Phase = "edit" | "preview" | "success" | "error";

const PREVIEW_LIMIT = 40;

export function ContactImportSheet({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [hint, setHint] = useState<ImportHint>("auto");
  const [phase, setPhase] = useState<Phase>("edit");
  const [preview, setPreview] = useState<ContactImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) return;
    setText("");
    setFileName(null);
    setHint("auto");
    setPhase("edit");
    setPreview(null);
    setResult(null);
    setError(null);
  }, [open]);

  const review = useMutation({
    mutationFn: (input: { text: string; hint: ImportHint }) =>
      previewContactImport({ data: input }),
    onSuccess: (next) => {
      if (!next.rows.length) {
        setError("No phone numbers found. Use a column named phone, or paste one number per line.");
        setPhase("error");
        return;
      }
      setPreview(next);
      setError(null);
      setPhase("preview");
    },
    onError: (cause) => {
      setError(errorMessage(cause));
      setPhase("error");
    },
  });

  const commit = useMutation({
    mutationFn: () => commitContactImport({ data: { text, hint } }),
    onSuccess: async (next) => {
      setResult(next);
      setPhase("success");
      await onImported();
    },
    onError: (cause) => {
      setError(errorMessage(cause));
      setPhase("error");
    },
  });

  async function chooseFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_IMPORT_CHARS) {
      setError("That file is too large. Keep it under 2,000 contacts.");
      setPhase("error");
      return;
    }
    const body = await file.text();
    const nextHint: ImportHint = /\.vcf$|\.vcard$/i.test(file.name) ? "vcard" : "csv";
    setText(body);
    setFileName(file.name);
    setHint(nextHint);
    setError(null);
    review.mutate({ text: body, hint: nextHint });
  }

  const busy = review.isPending || commit.isPending;

  return (
    <Sheet open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] overflow-hidden rounded-t-3xl border-border bg-card p-0"
      >
        <div className="flex max-h-[85dvh] flex-col">
          <SheetHeader className="px-5 pt-5">
            <SheetTitle>Import contacts</SheetTitle>
          </SheetHeader>
          <ContactImportBody
            phase={phase}
            text={text}
            fileName={fileName}
            preview={preview}
            result={result}
            error={error}
            busy={busy}
            fileRef={fileRef}
            onText={(value) => {
              setText(value);
              setFileName(null);
              setHint("auto");
            }}
            onPickFile={() => fileRef.current?.click()}
            onFile={(file) => void chooseFile(file)}
            onClearFile={() => {
              setText("");
              setFileName(null);
              setHint("auto");
              setPhase("edit");
              setPreview(null);
              if (fileRef.current) fileRef.current.value = "";
            }}
            onReview={() => review.mutate({ text, hint })}
            onCommit={() => commit.mutate()}
            onBack={() => {
              setPhase("edit");
              setError(null);
            }}
            onClose={() => onOpenChange(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function ContactImportBody({
  phase,
  text,
  fileName,
  preview,
  result,
  error,
  busy,
  fileRef,
  onText,
  onPickFile,
  onFile,
  onClearFile,
  onReview,
  onCommit,
  onBack,
  onClose,
}: {
  phase: Phase;
  text: string;
  fileName: string | null;
  preview: ContactImportPreview | null;
  result: ImportResult | null;
  error: string | null;
  busy: boolean;
  fileRef: RefObject<HTMLInputElement | null>;
  onText: (value: string) => void;
  onPickFile: () => void;
  onFile: (file: File) => void;
  onClearFile: () => void;
  onReview: () => void;
  onCommit: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const shown = preview?.rows.slice(0, PREVIEW_LIMIT) ?? [];
  const hidden = (preview?.rows.length ?? 0) - shown.length;
  const canReview = text.trim().length > 0 && !busy;

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.vcf,.vcard,text/csv,text/vcard,text/x-vcard"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2">
        {phase === "edit" ? (
          <div data-testid="contact-import-empty" className="space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Upload a CSV or vCard, or paste numbers. Nothing is saved until you review the list.
            </p>
            {fileName ? (
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                  <FileUp className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{fileName}</p>
                  <p className="text-xs text-muted-foreground">Ready to review</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 rounded-xl px-3"
                  onClick={onClearFile}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <Textarea
                value={text}
                onChange={(event) => onText(event.target.value)}
                rows={6}
                placeholder={"Jane Rivera, (555) 201-0198\n555-201-0144"}
                className="min-h-32 rounded-xl"
                aria-label="Contact list"
              />
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">
              Headers can be name, phone, mobile, email, company, or notes. One phone number per
              line works too.
            </p>
          </div>
        ) : null}

        {phase === "error" ? (
          <div data-testid="contact-import-error" className="space-y-3 py-2" role="alert">
            <p className="text-sm font-semibold">Couldn&apos;t read that list</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {error || "Check the file and try again."}
            </p>
          </div>
        ) : null}

        {phase === "preview" && preview ? (
          <div data-testid="contact-import-preview" className="space-y-3">
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-sm font-semibold">
                {preview.created === 0
                  ? "Nothing new to add"
                  : `${preview.created} ${preview.created === 1 ? "contact" : "contacts"} will be added`}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{skipSentence(preview)}</p>
              {preview.truncated ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Only the first {MAX_IMPORT_ROWS.toLocaleString()} rows were reviewed. Split the
                  rest into another file.
                </p>
              ) : null}
            </div>
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
              {shown.map((row, index) => (
                <li key={`${row.line}-${index}`} className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {row.name || formatPhone(row.phone) || "No name"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.phone ? formatPhone(row.phone) : row.phoneRaw || "No phone"}
                      {row.status === "create" && row.email ? ` · ${row.email}` : ""}
                      {row.status !== "create" ? ` · ${row.reason}` : ""}
                    </p>
                  </div>
                  <span
                    className={
                      row.status === "create"
                        ? "shrink-0 text-xs font-semibold text-primary"
                        : row.status === "invalid"
                          ? "shrink-0 text-xs font-semibold text-destructive"
                          : "shrink-0 text-xs font-semibold text-muted-foreground"
                    }
                  >
                    {row.status === "create" ? "Add" : "Skip"}
                  </span>
                </li>
              ))}
            </ul>
            {hidden > 0 ? (
              <p className="text-center text-xs text-muted-foreground">
                And {hidden} more {hidden === 1 ? "row" : "rows"}
              </p>
            ) : null}
          </div>
        ) : null}

        {phase === "success" && result ? (
          <div data-testid="contact-import-success" className="space-y-2 py-2">
            <p className="font-display text-lg font-semibold">
              {result.created === 0
                ? "Nothing new to add"
                : `Added ${result.created} ${result.created === 1 ? "contact" : "contacts"}`}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">{resultDetail(result)}</p>
          </div>
        ) : null}
      </div>

      <div className="space-y-2 border-t border-border px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {phase === "edit" ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full rounded-xl"
              onClick={onPickFile}
              disabled={busy}
            >
              <Upload className="size-4" />
              Upload CSV or vCard
            </Button>
            <Button
              type="button"
              className="h-12 w-full rounded-xl font-semibold"
              onClick={onReview}
              disabled={!canReview}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Review list"}
            </Button>
          </>
        ) : null}
        {phase === "preview" && preview ? (
          <>
            <Button
              type="button"
              className="h-12 w-full rounded-xl font-semibold"
              onClick={onCommit}
              disabled={busy || preview.created === 0}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : preview.created === 0 ? (
                "Nothing to add"
              ) : (
                `Import ${preview.created} ${preview.created === 1 ? "contact" : "contacts"}`
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-12 w-full rounded-xl"
              onClick={onBack}
              disabled={busy}
            >
              Back
            </Button>
          </>
        ) : null}
        {phase === "error" ? (
          <Button type="button" className="h-12 w-full rounded-xl font-semibold" onClick={onBack}>
            Try again
          </Button>
        ) : null}
        {phase === "success" ? (
          <Button type="button" className="h-12 w-full rounded-xl font-semibold" onClick={onClose}>
            Done
          </Button>
        ) : null}
      </div>
    </>
  );
}

function skipSentence(preview: ContactImportPreview) {
  const parts: string[] = [];
  if (preview.skippedInvalid) {
    parts.push(
      `${preview.skippedInvalid} ${preview.skippedInvalid === 1 ? "has" : "have"} no usable phone`,
    );
  }
  if (preview.skippedDuplicate) {
    parts.push(
      `${preview.skippedDuplicate} ${preview.skippedDuplicate === 1 ? "is" : "are"} already saved`,
    );
  }
  if (!parts.length) return "No rows will be skipped.";
  return `${parts.join(", and ")}.`;
}

function resultDetail(result: ImportResult) {
  const parts: string[] = [];
  if (result.skippedInvalid) {
    parts.push(`${result.skippedInvalid} skipped — no usable phone.`);
  }
  if (result.skippedDuplicate) {
    parts.push(`${result.skippedDuplicate} skipped — already in your contacts.`);
  }
  if (!parts.length) return "Every number in that list is now saved.";
  return parts.join(" ");
}
