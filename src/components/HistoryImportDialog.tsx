import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/format";
import { importHistory, importCallHistory, previewHistoryImport } from "@/lib/twilio.functions";
import { toastError } from "@/lib/toast-error";

export function useHistoryImport(kind: "calls" | "messages", onComplete: () => Promise<unknown>) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ ids: string[]; skipped: number } | null>(null);
  async function open() {
    setBusy(true);
    try {
      setPreview(await previewHistoryImport({ data: { kind } }));
    } catch (error) {
      toastError(error);
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!preview || busy) return;
    setBusy(true);
    try {
      const action = kind === "calls" ? importCallHistory : importHistory;
      const result = await action({ data: { confirmedIds: preview.ids } });
      toast.success(`Imported ${result.imported} ${kind}.`);
      setPreview(null);
      await onComplete();
    } catch (error) {
      toastError(error);
    } finally {
      setBusy(false);
    }
  }
  const dialog = (
    <AlertDialog
      open={preview !== null}
      onOpenChange={(value) => {
        if (!value && !busy) setPreview(null);
      }}
    >
      <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Import {kind === "calls" ? "call" : "text"} history?</AlertDialogTitle>
          <AlertDialogDescription>
            {preview?.ids.length ?? 0} new {kind} will be imported from the most recent{" "}
            {kind === "calls" ? "100 calls" : "200 texts"}. {preview?.skipped ?? 0} existing, empty,
            internal, or unassigned items will be skipped. Existing records stay unchanged.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button onClick={confirm} disabled={busy || !preview?.ids.length}>
            {busy ? "Importing…" : "Import"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
  return { open, busy, dialog };
}
